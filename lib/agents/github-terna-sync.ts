import { LinearAPI } from './linear-client';
import { ternaSync, TernaProjectData, TernaIssueData } from './terna-sync';
import { Octokit } from '@octokit/rest';
import matter from 'gray-matter';

export interface GitHubTernaSyncOptions {
  owner: string;
  repo: string;
  branch?: string;
  githubToken: string;
}

export class GitHubTernaSync {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch: string;

  constructor(options: GitHubTernaSyncOptions) {
    this.octokit = new Octokit({
      auth: options.githubToken,
    });
    this.owner = options.owner;
    this.repo = options.repo;
    this.branch = options.branch || 'main';
  }

  /**
   * Sync projects from GitHub repository's terna folder to Linear
   */
  async syncFromGitHub(): Promise<{
    projectsCreated: number;
    issuesCreated: number;
    errors: string[];
  }> {
    const result = {
      projectsCreated: 0,
      issuesCreated: 0,
      errors: [] as string[],
    };

    try {
      // Get the terna/projects folder contents
      const { data: projectsFolder } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'terna/projects',
        ref: this.branch,
      });

      if (!Array.isArray(projectsFolder)) {
        throw new Error('terna/projects is not a directory');
      }

      // Process each project folder
      for (const projectFolder of projectsFolder) {
        if (projectFolder.type !== 'dir') continue;

        try {
          // Get project.md file
          const { data: projectFile } = await this.octokit.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path: `${projectFolder.path}/project.md`,
            ref: this.branch,
          });

          if ('content' in projectFile) {
            const content = Buffer.from(projectFile.content, 'base64').toString('utf-8');
            const { data: projectData, content: projectContent } = matter(content);
            const ternaProject = projectData as TernaProjectData;

            // Check if project already exists in Linear
            const existingProjects = await LinearAPI.searchProjects(ternaProject.name);
            let linearProject;

            if (existingProjects.length === 0) {
              // Create new project in Linear
              const milestones = ternaProject.milestones?.map(m => ({
                name: m.name,
                definitionOfDone: m.description,
              }));

              linearProject = await LinearAPI.createProject({
                name: ternaProject.name,
                description: ternaProject.description || '',
                content: projectContent || ternaProject.content,
                targetDate: ternaProject.target,
                milestones,
              });

              result.projectsCreated++;
              console.log(`Created project: ${ternaProject.name}`);
            } else {
              linearProject = existingProjects[0];
              console.log(`Project already exists: ${ternaProject.name}`);
            }

            // Process issues for this project
            if (linearProject.team?.id) {
              const issuesCreated = await this.syncProjectIssues(
                projectFolder.path,
                linearProject.id,
                linearProject.team.id
              );
              result.issuesCreated += issuesCreated;
            } else {
              const errorMsg = `Could not determine team for project ${linearProject.name}. Cannot sync issues.`;
              console.error(errorMsg);
              result.errors.push(errorMsg);
            }
          }
        } catch (error) {
          const errorMsg = `Error processing project ${projectFolder.name}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Error accessing terna folder: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Sync issues for a specific project
   */
  private async syncProjectIssues(
    projectPath: string,
    linearProjectId: string,
    teamId: string,
    parentIssueId?: string,
    issuePath: string = 'issues'
  ): Promise<number> {
    let issuesCreated = 0;

    try {
      const { data: issuesFolder } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: `${projectPath}/${issuePath}`,
        ref: this.branch,
      });

      if (!Array.isArray(issuesFolder)) {
        return issuesCreated;
      }

      for (const issueFolder of issuesFolder) {
        if (issueFolder.type !== 'dir') continue;

        try {
          // Get issue.md file
          const { data: issueFile } = await this.octokit.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path: `${issueFolder.path}/issue.md`,
            ref: this.branch,
          });

          if ('content' in issueFile) {
            const content = Buffer.from(issueFile.content, 'base64').toString('utf-8');
            const { data: issueData, content: issueContent } = matter(content);
            const ternaIssue = issueData as TernaIssueData;

            // Check if issue already exists (by identifier)
            const existingIssue = await LinearAPI.searchIssues(ternaIssue.identifier, teamId);
            
            if (existingIssue.length === 0) {
              // Get workflow state
              const states = await LinearAPI.getWorkflowStates(teamId);
              const stateId = states.find(s => 
                s.name.toLowerCase() === ternaIssue.status.toLowerCase()
              )?.id;

              // Get labels
              const teamLabels = await LinearAPI.getTeamLabels(teamId);
              const labelIds = ternaIssue.labels?.map(labelName => 
                teamLabels.find(l => l.name === labelName)?.id
              ).filter(Boolean) as string[] || [];

              // Convert priority
              const priorityMap: { [key: string]: number } = {
                'none': 0,
                'urgent': 1,
                'high': 2,
                'normal': 3,
                'low': 4,
              };

              // Create issue in Linear
              const createdIssue = await LinearAPI.createIssue({
                title: ternaIssue.title,
                description: issueContent || ternaIssue.description || '',
                teamId,
                projectId: linearProjectId,
                priority: priorityMap[ternaIssue.priority] || 3,
                estimate: ternaIssue.estimate,
                labels: labelIds,
                stateId,
                parentId: parentIssueId,
              });

              issuesCreated++;
              console.log(`Created issue: ${ternaIssue.identifier} - ${ternaIssue.title}`);

              // Process sub-issues
              const subIssuesCreated = await this.syncProjectIssues(
                projectPath,
                linearProjectId,
                teamId,
                createdIssue.id,
                `${issueFolder.path}/sub-issues`
              );
              issuesCreated += subIssuesCreated;
            } else {
              console.log(`Issue already exists: ${ternaIssue.identifier}`);
            }
          }
        } catch (error) {
          console.error(`Error processing issue ${issueFolder.name}:`, error);
        }
      }
    } catch (error) {
      // Folder might not exist, which is okay
      if ((error as any).status !== 404) {
        console.error(`Error accessing issues folder:`, error);
      }
    }

    return issuesCreated;
  }

  /**
   * Download and sync terna folder from GitHub to local filesystem
   */
  async downloadTernaFolder(localPath: string = './terna'): Promise<void> {
    const terna = new TernaSync(localPath);

    try {
      // Get all projects from GitHub
      const { data: projectsFolder } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'terna/projects',
        ref: this.branch,
      });

      if (!Array.isArray(projectsFolder)) {
        throw new Error('terna/projects is not a directory');
      }

      for (const projectFolder of projectsFolder) {
        if (projectFolder.type !== 'dir') continue;

        // Download project.md
        const { data: projectFile } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: `${projectFolder.path}/project.md`,
          ref: this.branch,
        });

        if ('content' in projectFile) {
          const content = Buffer.from(projectFile.content, 'base64').toString('utf-8');
          const { data: projectData } = matter(content);
          const ternaProject = projectData as TernaProjectData;

          // Create a mock LinearProject for syncing
          const mockProject = {
            id: ternaProject.id,
            name: ternaProject.name,
            description: ternaProject.description,
            content: ternaProject.content,
            state: ternaProject.status,
            progress: 0,
            targetDate: ternaProject.target,
            url: ternaProject.linear_url,
          };

          const mockMilestones = ternaProject.milestones?.map(m => ({
            id: '',
            name: m.name,
            description: m.description,
            targetDate: undefined,
          }));

          await terna.syncProject(mockProject, mockMilestones);

          // Download issues
          await this.downloadProjectIssues(
            projectFolder.path,
            terna.getProjectFolderName(ternaProject.name),
            terna
          );
        }
      }
    } catch (error) {
      console.error('Error downloading terna folder:', error);
      throw error;
    }
  }

  /**
   * Download issues for a project
   */
  private async downloadProjectIssues(
    projectPath: string,
    projectFolderName: string,
    terna: TernaSync,
    parentIssueFolder?: string,
    issuePath: string = 'issues'
  ): Promise<void> {
    try {
      const { data: issuesFolder } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: `${projectPath}/${issuePath}`,
        ref: this.branch,
      });

      if (!Array.isArray(issuesFolder)) return;

      for (const issueFolder of issuesFolder) {
        if (issueFolder.type !== 'dir') continue;

        const { data: issueFile } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: `${issueFolder.path}/issue.md`,
          ref: this.branch,
        });

        if ('content' in issueFile) {
          const content = Buffer.from(issueFile.content, 'base64').toString('utf-8');
          const { data: issueData } = matter(content);
          const ternaIssue = issueData as TernaIssueData;

          // Create a mock LinearIssue for syncing
          const mockIssue = {
            id: ternaIssue.id,
            identifier: ternaIssue.identifier,
            title: ternaIssue.title,
            description: ternaIssue.description,
            state: {
              id: '',
              name: ternaIssue.status,
              type: '',
            },
            priority: this.getPriorityNumber(ternaIssue.priority),
            estimate: ternaIssue.estimate,
            labels: ternaIssue.labels?.map(name => ({ id: '', name })) || [],
            assignee: ternaIssue.assignee ? { id: '', name: ternaIssue.assignee } : undefined,
            team: { id: '', name: '', key: '' },
            url: ternaIssue.linear_url,
          };

          const issueFolderName = await terna.syncIssue(mockIssue, projectFolderName, parentIssueFolder);

          // Download sub-issues
          await this.downloadProjectIssues(
            projectPath,
            projectFolderName,
            terna,
            issueFolderName,
            `${issueFolder.path}/sub-issues`
          );
        }
      }
    } catch (error) {
      if ((error as any).status !== 404) {
        console.error('Error downloading issues:', error);
      }
    }
  }

  private getPriorityNumber(priority: string): number {
    const priorityMap: { [key: string]: number } = {
      'none': 0,
      'urgent': 1,
      'high': 2,
      'normal': 3,
      'low': 4,
    };
    return priorityMap[priority] || 3;
  }
}