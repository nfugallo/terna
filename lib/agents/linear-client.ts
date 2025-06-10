import { LinearClient } from '@linear/sdk';

// Lazy initialization of the Linear client
let _linearClient: LinearClient | null = null;

function getLinearClient(): LinearClient {
  if (!_linearClient) {
    const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
    if (!LINEAR_API_KEY) {
      throw new Error('LINEAR_API_KEY environment variable is not set');
    }
    _linearClient = new LinearClient({
      apiKey: LINEAR_API_KEY,
    });
  }
  return _linearClient;
}

export const linearClient = {
  get teams() { return getLinearClient().teams; },
  get projects() { return getLinearClient().projects; },
  get issues() { return getLinearClient().issues; },
  get project() { return getLinearClient().project.bind(getLinearClient()); },
  get createProject() { return getLinearClient().createProject.bind(getLinearClient()); },
  get createProjectMilestone() { return getLinearClient().createProjectMilestone.bind(getLinearClient()); },
  get issue() { return getLinearClient().issue.bind(getLinearClient()); },
  get createIssue() { return getLinearClient().createIssue.bind(getLinearClient()); },
  get team() { return getLinearClient().team.bind(getLinearClient()); },
  get updateProject() { return getLinearClient().updateProject.bind(getLinearClient()); },
  get updateIssue() { return getLinearClient().updateIssue.bind(getLinearClient()); },
  get viewer() { return getLinearClient().viewer; },
};

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  content?: string;
  state: string;
  progress: number;
  targetDate?: string;
  url: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: {
    id: string;
    name: string;
    type: string;
  };
  priority: number;
  estimate?: number;
  labels: Array<{
    id: string;
    name: string;
  }>;
  assignee?: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
  url: string;
}

export interface LinearMilestone {
  id: string;
  name: string;
  description?: string;
  targetDate?: string;
}

// Linear API helper functions
export class LinearAPI {
  
  /**
   * Get all teams in the workspace
   */
  static async getTeams(): Promise<LinearTeam[]> {
    try {
      const teams = await linearClient.teams();
      return teams.nodes.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
      }));
    } catch (error) {
      console.error('Error fetching teams:', error);
      throw error;
    }
  }

  /**
   * Get a specific team by name or ID
   */
  static async getTeam(identifier: string): Promise<LinearTeam | null> {
    try {
      const teams = await this.getTeams();
      return teams.find(team => 
        team.name.toLowerCase().includes(identifier.toLowerCase()) ||
        team.key.toLowerCase() === identifier.toLowerCase() ||
        team.id === identifier
      ) || null;
    } catch (error) {
      console.error('Error fetching team:', error);
      throw error;
    }
  }

  /**
   * Create a new project
   */
  static async createProject(params: {
    name: string;
    description: string;
    content?: string;
    targetDate?: string;
    teamId?: string;
    milestones?: Array<{
      name: string;
      definitionOfDone: string;
    }>;
  }): Promise<LinearProject> {
    try {
      // Get Engineering team if no team specified
      let teamId = params.teamId;
      if (!teamId) {
        const engineeringTeam = await this.getTeam('Engineering');
        if (!engineeringTeam) {
          throw new Error('Could not find Engineering team. Please specify a teamId.');
        }
        teamId = engineeringTeam.id;
      }

      const projectPayload = await linearClient.createProject({
        name: params.name,
        description: params.description,
        content: params.content,
        targetDate: params.targetDate,
        teamIds: [teamId],
      });

      if (!projectPayload.success || !projectPayload.project) {
        throw new Error('Failed to create project');
      }

      // Get the created project
      const project = await projectPayload.project;

      // Create milestones if provided
      if (params.milestones && params.milestones.length > 0) {
        for (const milestone of params.milestones) {
          await linearClient.createProjectMilestone({
            projectId: project.id,
            name: milestone.name,
            description: milestone.definitionOfDone,
          });
        }
      }

      return {
        id: project.id,
        name: project.name,
        description: project.description || '',
        content: project.content || '',
        state: project.state,
        progress: project.progress,
        targetDate: project.targetDate?.toISOString(),
        url: `https://linear.app/simpl/project/${project.id}`,
      };
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  static async getProject(projectId: string): Promise<LinearProject | null> {
    try {
      const project = await linearClient.project(projectId);
      if (!project) return null;

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        content: project.content,
        state: project.state,
        progress: project.progress,
        targetDate: project.targetDate ? (typeof project.targetDate === 'string' ? project.targetDate : project.targetDate.toISOString()) : undefined,
        url: `https://linear.app/simpl/project/${project.id}`,
      };
    } catch (error) {
      console.error('Error fetching project:', error);
      return null;
    }
  }

  /**
   * Get all projects in the workspace
   */
  static async getAllProjects(): Promise<LinearProject[]> {
    try {
      const projects = await linearClient.projects();
      return projects.nodes.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        content: project.content,
        state: project.state,
        progress: project.progress,
        targetDate: project.targetDate ? (typeof project.targetDate === 'string' ? project.targetDate : project.targetDate.toISOString()) : undefined,
        url: `https://linear.app/simpl/project/${project.id}`,
      }));
    } catch (error) {
      console.error('Error fetching all projects:', error);
      throw error;
    }
  }

  /**
   * Search projects by name
   */
  static async searchProjects(query: string): Promise<LinearProject[]> {
    try {
      const projects = await linearClient.projects();
      const filteredProjects = projects.nodes.filter(project =>
        project.name.toLowerCase().includes(query.toLowerCase())
      );

      return filteredProjects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        content: project.content,
        state: project.state,
        progress: project.progress,
        targetDate: project.targetDate ? (typeof project.targetDate === 'string' ? project.targetDate : project.targetDate.toISOString()) : undefined,
        url: `https://linear.app/simpl/project/${project.id}`,
      }));
    } catch (error) {
      console.error('Error searching projects:', error);
      throw error;
    }
  }

  /**
   * Get project milestones
   */
  static async getProjectMilestones(projectId: string): Promise<LinearMilestone[]> {
    try {
      const project = await linearClient.project(projectId);
      if (!project) return [];

      const milestones = await project.projectMilestones();
      return milestones.nodes.map(milestone => ({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        targetDate: milestone.targetDate ? (typeof milestone.targetDate === 'string' ? milestone.targetDate : milestone.targetDate.toISOString()) : undefined,
      }));
    } catch (error) {
      console.error('Error fetching project milestones:', error);
      throw error;
    }
  }

  /**
   * Get project issues (excluding sub-issues)
   */
  static async getProjectIssues(projectId: string): Promise<LinearIssue[]> {
    try {
      const project = await linearClient.project(projectId);
      if (!project) return [];

      const issues = await project.issues({
        filter: {
          parent: { null: true }, // Only get parent issues, not sub-issues
        },
      });
      
      return Promise.all(issues.nodes.map(async (issue: any) => {
        const team = await issue.team;
        const state = await issue.state;
        const assignee = await issue.assignee;
        const labels = await issue.labels();

        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description || '',
          state: {
            id: state?.id || '',
            name: state?.name || '',
            type: state?.type || '',
          },
          priority: issue.priority,
          estimate: issue.estimate,
          labels: labels?.nodes.map((label: any) => ({
            id: label.id,
            name: label.name,
          })) || [],
          assignee: assignee ? {
            id: assignee.id,
            name: assignee.name,
          } : undefined,
          team: {
            id: team?.id || '',
            name: team?.name || '',
            key: team?.key || '',
          },
          url: `https://linear.app/simpl/issue/${issue.identifier}`,
        };
      }));
    } catch (error) {
      console.error('Error fetching project issues:', error);
      throw error;
    }
  }

  /**
   * Get sub-issues for a specific issue
   */
  static async getIssueSubIssues(issueId: string): Promise<LinearIssue[]> {
    try {
      const parentIssue = await linearClient.issue(issueId);
      if (!parentIssue) return [];

      const subIssues = await parentIssue.children();
      
      return Promise.all(subIssues.nodes.map(async (issue: any) => {
        const team = await issue.team;
        const state = await issue.state;
        const assignee = await issue.assignee;
        const labels = await issue.labels();

        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description || '',
          state: {
            id: state?.id || '',
            name: state?.name || '',
            type: state?.type || '',
          },
          priority: issue.priority,
          estimate: issue.estimate,
          labels: labels?.nodes.map((label: any) => ({
            id: label.id,
            name: label.name,
          })) || [],
          assignee: assignee ? {
            id: assignee.id,
            name: assignee.name,
          } : undefined,
          team: {
            id: team?.id || '',
            name: team?.name || '',
            key: team?.key || '',
          },
          url: `https://linear.app/simpl/issue/${issue.identifier}`,
        };
      }));
    } catch (error) {
      console.error('Error fetching issue sub-issues:', error);
      throw error;
    }
  }

  /**
   * Create a new issue
   */
  static async createIssue(params: {
    title: string;
    description: string;
    teamId: string;
    projectId?: string;
    priority?: number;
    estimate?: number;
    labels?: string[];
    assigneeId?: string;
    stateId?: string;
    parentId?: string;
    projectMilestoneId?: string;
  }): Promise<LinearIssue> {
    try {
      const issuePayload = await linearClient.createIssue({
        title: params.title,
        description: params.description,
        teamId: params.teamId,
        projectId: params.projectId,
        priority: params.priority,
        estimate: params.estimate,
        labelIds: params.labels,
        assigneeId: params.assigneeId,
        stateId: params.stateId,
        parentId: params.parentId,
        projectMilestoneId: params.projectMilestoneId,
      });

      if (!issuePayload.success || !issuePayload.issue) {
        throw new Error('Failed to create issue');
      }

      const issue = await issuePayload.issue;
      const team = await issue.team;
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || '',
        state: {
          id: state?.id || '',
          name: state?.name || '',
          type: state?.type || '',
        },
        priority: issue.priority,
        estimate: issue.estimate,
        labels: labels?.nodes.map((label: any) => ({
          id: label.id,
          name: label.name,
        })) || [],
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
        } : undefined,
        team: {
          id: team?.id || '',
          name: team?.name || '',
          key: team?.key || '',
        },
        url: `https://linear.app/simpl/issue/${issue.identifier}`,
      };
    } catch (error) {
      console.error('Error creating issue:', error);
      throw error;
    }
  }

  /**
   * Get workflow states for a team
   */
  static async getWorkflowStates(teamId: string): Promise<Array<{
    id: string;
    name: string;
    type: string;
  }>> {
    try {
      const team = await linearClient.team(teamId);
      if (!team) return [];

      const states = await team.states();
      return states.nodes.map(state => ({
        id: state.id,
        name: state.name,
        type: state.type,
      }));
    } catch (error) {
      console.error('Error fetching workflow states:', error);
      throw error;
    }
  }

  /**
   * Get team labels
   */
  static async getTeamLabels(teamId: string): Promise<Array<{
    id: string;
    name: string;
    color: string;
  }>> {
    try {
      const team = await linearClient.team(teamId);
      if (!team) return [];

      const labels = await team.labels();
      return labels.nodes.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
      }));
    } catch (error) {
      console.error('Error fetching team labels:', error);
      throw error;
    }
  }

  /**
   * Update an existing project
   */
  static async updateProject(params: {
    projectId: string;
    name?: string;
    description?: string;
    content?: string;
    targetDate?: string;
  }): Promise<LinearProject> {
    try {
      const updateData: any = {};
      
      if (params.name !== undefined) updateData.name = params.name;
      if (params.description !== undefined) updateData.description = params.description;
      if (params.content !== undefined) updateData.content = params.content;
      if (params.targetDate !== undefined) updateData.targetDate = params.targetDate;

      const projectPayload = await linearClient.updateProject(params.projectId, updateData);

      if (!projectPayload.success || !projectPayload.project) {
        throw new Error('Failed to update project');
      }

      const project = await projectPayload.project;

      return {
        id: project.id,
        name: project.name,
        description: project.description || '',
        content: project.content || '',
        state: project.state,
        progress: project.progress,
        targetDate: project.targetDate ? (typeof project.targetDate === 'string' ? project.targetDate : project.targetDate.toISOString()) : undefined,
        url: `https://linear.app/simpl/project/${project.id}`,
      };
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  /**
   * Update an existing issue
   */
  static async updateIssue(params: {
    issueId: string;
    title?: string;
    description?: string;
    priority?: number;
    estimate?: number;
    labels?: string[];
    assigneeId?: string;
    stateId?: string;
  }): Promise<LinearIssue> {
    try {
      const issuePayload = await linearClient.updateIssue(params.issueId, {
        title: params.title,
        description: params.description,
        priority: params.priority,
        estimate: params.estimate,
        labelIds: params.labels,
        assigneeId: params.assigneeId,
        stateId: params.stateId,
      });

      if (!issuePayload.success || !issuePayload.issue) {
        throw new Error('Failed to update issue');
      }

      const issue = await issuePayload.issue;
      const team = await issue.team;
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || '',
        state: {
          id: state?.id || '',
          name: state?.name || '',
          type: state?.type || '',
        },
        priority: issue.priority,
        estimate: issue.estimate,
        labels: labels?.nodes.map((label: any) => ({
          id: label.id,
          name: label.name,
        })) || [],
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
        } : undefined,
        team: {
          id: team?.id || '',
          name: team?.name || '',
          key: team?.key || '',
        },
        url: `https://linear.app/simpl/issue/${issue.identifier}`,
      };
    } catch (error) {
      console.error('Error updating issue:', error);
      throw error;
    }
  }

  /**
   * Get a specific issue by ID
   */
  static async getIssue(issueId: string): Promise<LinearIssue | null> {
    try {
      const issue = await linearClient.issue(issueId);
      if (!issue) return null;

      const team = await issue.team;
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        state: {
          id: state?.id || '',
          name: state?.name || '',
          type: state?.type || '',
        },
        priority: issue.priority,
        estimate: issue.estimate,
        labels: labels?.nodes.map(label => ({
          id: label.id,
          name: label.name,
        })) || [],
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
        } : undefined,
        team: {
          id: team?.id || '',
          name: team?.name || '',
          key: team?.key || '',
        },
        url: `https://linear.app/simpl/issue/${issue.identifier}`,
      };
    } catch (error) {
      console.error('Error fetching issue:', error);
      return null;
    }
  }

  /**
   * Search issues by title or description
   */
  static async searchIssues(query: string, teamId?: string): Promise<LinearIssue[]> {
    try {
      const searchParams = teamId ? { filter: { team: { id: { eq: teamId } } } } : {};
      const issues = await linearClient.issues(searchParams);
      
      const filteredIssues = issues.nodes.filter(issue =>
        issue.title.toLowerCase().includes(query.toLowerCase()) ||
        (issue.description && issue.description.toLowerCase().includes(query.toLowerCase()))
      );

      return Promise.all(filteredIssues.map(async (issue: any) => {
        const team = await issue.team;
        const state = await issue.state;
        const assignee = await issue.assignee;
        const labels = await issue.labels();

        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
          state: {
            id: state?.id || '',
            name: state?.name || '',
            type: state?.type || '',
          },
          priority: issue.priority,
          estimate: issue.estimate,
          labels: labels?.nodes.map((label: any) => ({
            id: label.id,
            name: label.name,
          })) || [],
          assignee: assignee ? {
            id: assignee.id,
            name: assignee.name,
          } : undefined,
          team: {
            id: team?.id || '',
            name: team?.name || '',
            key: team?.key || '',
          },
          url: `https://linear.app/simpl/issue/${issue.identifier}`,
        };
      }));
    } catch (error) {
      console.error('Error searching issues:', error);
      throw error;
    }
  }

  /**
   * Get current user (viewer)
   */
  static async getCurrentUser(): Promise<{
    id: string;
    name: string;
    email: string;
  } | null> {
    try {
      const viewer = await linearClient.viewer;
      return {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
      };
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }
} 