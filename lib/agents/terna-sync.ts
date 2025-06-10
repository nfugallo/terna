import { promises as fs } from 'fs';
import path from 'path';
import { LinearProject, LinearIssue, LinearMilestone } from './linear-client';
import matter from 'gray-matter';

export interface TernaProjectData {
  id: string;
  name: string;
  status: string;
  linear_url: string;
  created: string;
  target?: string;
  description?: string;
  content?: string;
  milestones?: Array<{
    name: string;
    description: string;
    completed: boolean;
  }>;
}

export interface TernaIssueData {
  id: string;
  identifier: string;
  title: string;
  status: string;
  assignee?: string;
  priority: string;
  parent?: string | null;
  linear_url: string;
  estimate?: number;
  labels?: string[];
  description?: string;
  definition_of_done?: string[];
}

export class TernaSync {
  private ternaPath: string;

  constructor(ternaPath: string = './terna') {
    this.ternaPath = ternaPath;
  }

  /**
   * Ensure the terna directory structure exists
   */
  private async ensureTernaStructure(): Promise<void> {
    const projectsPath = path.join(this.ternaPath, 'projects');
    await fs.mkdir(projectsPath, { recursive: true });
  }

  /**
   * Convert Linear priority number to string
   */
  private getPriorityString(priority: number): string {
    switch (priority) {
      case 0: return 'none';
      case 1: return 'urgent';
      case 2: return 'high';
      case 3: return 'normal';
      case 4: return 'low';
      default: return 'normal';
    }
  }

  /**
   * Sanitize name for folder creation
   */
  private sanitizeFolderName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Create or update a project in the terna folder
   */
  async syncProject(project: LinearProject, milestones?: LinearMilestone[]): Promise<string> {
    await this.ensureTernaStructure();

    const projectFolderName = this.sanitizeFolderName(project.name);
    const projectPath = path.join(this.ternaPath, 'projects', projectFolderName);
    
    // Create project directory
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'issues'), { recursive: true });

    // Prepare project data
    const projectData: TernaProjectData = {
      id: project.id,
      name: project.name,
      status: project.state.toLowerCase(),
      linear_url: project.url,
      created: new Date().toISOString().split('T')[0],
      target: project.targetDate ? new Date(project.targetDate).toISOString().split('T')[0] : undefined,
      description: project.description,
      content: project.content,
    };

    // Add milestones if provided
    if (milestones && milestones.length > 0) {
      projectData.milestones = milestones.map(m => ({
        name: m.name,
        description: m.description || '',
        completed: false,
      }));
    }

    // Create project.md content
    let content = matter.stringify('', projectData);
    content += `# ${project.name}\n\n`;
    
    if (project.description) {
      content += `${project.description}\n\n`;
    }
    
    if (project.content) {
      content += `${project.content}\n\n`;
    }

    if (milestones && milestones.length > 0) {
      content += `## Milestones\n`;
      milestones.forEach(milestone => {
        content += `- [ ] ${milestone.name}`;
        if (milestone.description) {
          content += ` - ${milestone.description}`;
        }
        content += '\n';
      });
    }

    // Write project.md
    await fs.writeFile(path.join(projectPath, 'project.md'), content);

    return projectPath;
  }

  /**
   * Create or update an issue in the terna folder
   */
  async syncIssue(issue: LinearIssue, projectFolderName: string, parentIssueFolder?: string): Promise<string> {
    const projectPath = path.join(this.ternaPath, 'projects', projectFolderName);
    
    // Determine issue path
    let issuePath: string;
    if (parentIssueFolder) {
      // This is a sub-issue
      issuePath = path.join(projectPath, 'issues', parentIssueFolder, 'sub-issues');
    } else {
      // This is a main issue
      issuePath = path.join(projectPath, 'issues');
    }

    // Create issue folder name
    const issueFolderName = `${issue.identifier.toLowerCase()}-${this.sanitizeFolderName(issue.title)}`;
    const issueFullPath = path.join(issuePath, issueFolderName);

    // Create directories
    await fs.mkdir(issueFullPath, { recursive: true });
    if (!parentIssueFolder) {
      // Only create sub-issues and attempts folders for main issues
      await fs.mkdir(path.join(issueFullPath, 'sub-issues'), { recursive: true });
      await fs.mkdir(path.join(issueFullPath, 'attempts'), { recursive: true });
    }

    // Prepare issue data, avoiding undefined values for YAML serialization
    const issueData: Partial<TernaIssueData> = {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      status: issue.state.name.toLowerCase().replace(/\s+/g, '-'),
      priority: this.getPriorityString(issue.priority),
      parent: parentIssueFolder || null,
      linear_url: issue.url,
      labels: issue.labels.map(l => l.name),
    };
    if (issue.assignee) {
      issueData.assignee = issue.assignee.name;
    }
    if (issue.estimate !== undefined && issue.estimate !== null) {
      issueData.estimate = issue.estimate;
    }
    if (issue.description !== undefined && issue.description !== null) {
      issueData.description = issue.description;
    }

    // Prepare main content for the markdown file
    let mainContent = `# ${issue.title}\n\n`;
    if (issue.description) {
      mainContent += `${issue.description}\n\n`;
    }

    // Add requirements section if there's description
    if (issue.description) {
      mainContent += `## Requirements\n`;
      // Parse description for bullet points or create them
      const lines = issue.description.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
          mainContent += `${line}\n`;
        } else if (line.trim()) {
          mainContent += `- ${line}\n`;
        }
      });
      mainContent += '\n';
    }

    // Add Definition of Done section
    mainContent += `## Definition of Done\n`;
    mainContent += `- [ ] Implementation complete\n`;
    mainContent += `- [ ] Tests written and passing\n`;
    mainContent += `- [ ] Code reviewed\n`;
    if (issue.labels.some(l => l.name.toLowerCase().includes('doc'))) {
      mainContent += `- [ ] Documentation updated\n`;
    }

    // Create issue.md content with frontmatter
    const content = matter.stringify(mainContent, issueData);

    // Write issue.md
    await fs.writeFile(path.join(issueFullPath, 'issue.md'), content);

    return issueFolderName;
  }

  /**
   * Load projects from terna folder (for GitHub integration)
   */
  async loadProjectsFromTerna(): Promise<TernaProjectData[]> {
    const projectsPath = path.join(this.ternaPath, 'projects');
    const projects: TernaProjectData[] = [];

    try {
      const projectFolders = await fs.readdir(projectsPath);
      
      for (const folder of projectFolders) {
        const projectPath = path.join(projectsPath, folder);
        const stat = await fs.stat(projectPath);
        
        if (stat.isDirectory()) {
          const projectFile = path.join(projectPath, 'project.md');
          
          try {
            const fileContent = await fs.readFile(projectFile, 'utf-8');
            const { data } = matter(fileContent);
            projects.push(data as TernaProjectData);
          } catch (error) {
            console.error(`Error reading project file ${projectFile}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading projects from terna:', error);
    }

    return projects;
  }

  /**
   * Load issues for a project from terna folder
   */
  async loadIssuesFromTerna(projectFolderName: string): Promise<TernaIssueData[]> {
    const issuesPath = path.join(this.ternaPath, 'projects', projectFolderName, 'issues');
    const issues: TernaIssueData[] = [];

    try {
      await this.loadIssuesRecursive(issuesPath, issues);
    } catch (error) {
      console.error('Error loading issues from terna:', error);
    }

    return issues;
  }

  /**
   * Recursively load issues including sub-issues
   */
  private async loadIssuesRecursive(
    currentPath: string, 
    issues: TernaIssueData[], 
    parentIssue?: string
  ): Promise<void> {
    try {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          const issueFile = path.join(itemPath, 'issue.md');
          
          try {
            const fileContent = await fs.readFile(issueFile, 'utf-8');
            const { data } = matter(fileContent);
            const issueData = data as TernaIssueData;
            
            if (parentIssue) {
              issueData.parent = parentIssue;
            }
            
            issues.push(issueData);
            
            // Check for sub-issues
            const subIssuesPath = path.join(itemPath, 'sub-issues');
            try {
              await fs.access(subIssuesPath);
              await this.loadIssuesRecursive(subIssuesPath, issues, issueData.identifier);
            } catch {
              // No sub-issues folder, continue
            }
          } catch (error) {
            console.error(`Error reading issue file ${issueFile}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
    }
  }

  /**
   * Check if a project already exists locally
   */
  async projectExists(projectName: string): Promise<boolean> {
    const projectFolderName = this.sanitizeFolderName(projectName);
    const projectPath = path.join(this.ternaPath, 'projects', projectFolderName);
    
    try {
      await fs.access(projectPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get project folder name from project name
   */
  getProjectFolderName(projectName: string): string {
    return this.sanitizeFolderName(projectName);
  }
}

// Export singleton instance
export const ternaSync = new TernaSync(); 