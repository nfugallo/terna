import { tool } from '@openai/agents';
import { z } from 'zod';
import { LinearAPI } from './linear-client';

// Helper function to convert null to undefined for API compatibility
function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

// Helper function to extract project ID from Linear URL or handle different ID formats
async function parseProjectId(input: string): Promise<string> {
  // If it's a URL like "https://linear.app/simplsales/project/trigger-batch-jobs-d16aaf0e1826"
  if (input.includes('linear.app')) {
    // First try to extract a full UUID from the URL
    const matches = input.match(/project\/.*?-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
    if (matches && matches[1]) {
      return matches[1];
    }
    // Alternative pattern for project URLs with full UUID
    const alternativeMatches = input.match(/project\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
    if (alternativeMatches && alternativeMatches[1]) {
      return alternativeMatches[1];
    }
    
    // If no UUID found, extract the project slug and search by name
    const slugMatches = input.match(/project\/([^\/]+)/);
    if (slugMatches && slugMatches[1]) {
      const slug = slugMatches[1];
      // Extract project name from slug (remove trailing identifier)
      const projectNameMatch = slug.match(/^(.+)-[a-f0-9]+$/);
      if (projectNameMatch) {
        const projectName = projectNameMatch[1].replace(/-/g, ' ');
        // Search for the project by name
        const allProjects = await LinearAPI.getAllProjects();
        const matchingProject = allProjects.find(p => 
          p.name.toLowerCase() === projectName.toLowerCase()
        );
        if (matchingProject) {
          return matchingProject.id;
        }
      }
    }
  }
  
  // If it's in format "proj_xxxxx", extract the UUID part
  if (input.startsWith('proj_')) {
    return input.replace('proj_', '');
  }
  
  // If it's already a UUID, return as is
  if (input.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)) {
    return input;
  }
  
  // If nothing else worked, assume it's a project name and search for it
  const allProjects = await LinearAPI.getAllProjects();
  const matchingProject = allProjects.find(p => 
    p.name.toLowerCase().includes(input.toLowerCase())
  );
  if (matchingProject) {
    return matchingProject.id;
  }
  
  // Fall back to returning the input as-is
  return input;
}

// Helper function to extract issue ID from Linear URL or handle different ID formats
function parseIssueId(input: string): string {
  // If it's a URL like "https://linear.app/simplsales/issue/SIM-123"
  if (input.includes('linear.app')) {
    const matches = input.match(/issue\/([A-Z]+-\d+)/);
    if (matches && matches[1]) {
      return matches[1];
    }
  }
  
  // If it's already an issue identifier or UUID, return as is
  return input;
}

// Project Planner Tools
export const linearProjectTools = {
  searchProjects: tool({
    name: 'search_projects',
    description: 'Search for existing Linear projects by name or keywords. Use this to check for duplicates or find related projects.',
    parameters: z.object({
      query: z.string().describe('Search query to find projects by name or keywords'),
    }),
    execute: async ({ query }) => {
      try {
        // First try to get all projects and filter more intelligently
        const allProjects = await LinearAPI.getAllProjects();
        
        // Search in both name and description
        const searchTerms = query.toLowerCase().split(' ');
        const filteredProjects = allProjects.filter(p => {
          const projectText = `${p.name} ${p.description || ''}`.toLowerCase();
          return searchTerms.some(term => projectText.includes(term));
        });

        return {
          success: true,
          projects: filteredProjects.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || 'No description',
            state: p.state,
            progress: p.progress,
            url: p.url,
          })),
          totalFound: filteredProjects.length,
          message: filteredProjects.length > 0 
            ? `Found ${filteredProjects.length} project(s) matching "${query}"`
            : `No projects found matching "${query}"`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          projects: [],
        };
      }
    },
  }),

  listAllProjects: tool({
    name: 'list_all_projects',
    description: 'List all projects in the Linear workspace, optionally filtered by state',
    parameters: z.object({
      includeArchived: z.boolean().default(false).describe('Include archived projects (default: false)'),
      state: z.enum(['planned', 'started', 'paused', 'completed', 'canceled', 'all']).default('all').describe('Filter by project state (default: all)'),
    }),
    execute: async ({ includeArchived = false, state = 'all' }) => {
      try {
        const allProjects = await LinearAPI.getAllProjects();
        
        let filteredProjects = allProjects;
        
        // Filter by archived status
        if (!includeArchived) {
          filteredProjects = filteredProjects.filter(p => p.state !== 'canceled' && p.state !== 'completed');
        }
        
        // Filter by state
        if (state !== 'all') {
          filteredProjects = filteredProjects.filter(p => p.state === state);
        }

        return {
          success: true,
          projects: filteredProjects.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || 'No description',
            state: p.state,
            progress: p.progress,
            url: p.url,
          })),
          totalCount: filteredProjects.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          projects: [],
        };
      }
    },
  }),

  getProject: tool({
    name: 'get_project',
    description: 'Get detailed information about a specific Linear project by ID or URL',
    parameters: z.object({
      projectId: z.string().describe('The Linear project ID, URL, or slug (supports URLs like https://linear.app/simplsales/project/...)'),
    }),
    execute: async ({ projectId }) => {
      try {
        const parsedId = await parseProjectId(projectId);
        console.log(`Parsing project ID: "${projectId}" -> "${parsedId}"`);
        
        const project = await LinearAPI.getProject(parsedId);
        if (!project) {
          return {
            success: false,
            error: 'Project not found',
            debug: {
              originalInput: projectId,
              parsedId: parsedId,
            },
          };
        }
        return {
          success: true,
          project,
        };
      } catch (error) {
        const parsedId = await parseProjectId(projectId);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: {
            originalInput: projectId,
            parsedId: parsedId,
          },
        };
      }
    },
  }),

  getTeams: tool({
    name: 'get_teams',
    description: 'Get all teams in the Linear workspace to find the correct team for project assignment',
    parameters: z.object({}),
    execute: async () => {
      try {
        const teams = await LinearAPI.getTeams();
        return {
          success: true,
          teams,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),

  createProject: tool({
    name: 'create_project',
    description: 'Create a new Linear project with milestones. Use "description" for a brief summary (max 255 chars) and "content" for detailed documentation.',
    parameters: z.object({
      name: z.string().describe('Project name'),
      description: z.string().describe('Brief project summary (max 255 characters)'),
      content: z.string().describe('Detailed project documentation in markdown format (leave empty string if none)'),
      targetDate: z.string().describe('Target completion date in ISO format (YYYY-MM-DD) or empty string if none'),
      teamId: z.string().describe('Team ID to assign the project to (use "20d21f17-a171-43ad-b265-a68ee95b7575" for Engineering)'),
      milestones: z.array(z.object({
        name: z.string().describe('Milestone name'),
        definitionOfDone: z.string().describe('Clear definition of done for the milestone'),
      })).describe('Array of project milestones (provide at least one milestone)'),
    }),
    needsApproval: true, // Creating projects should require approval
    execute: async ({ name, description, content, targetDate, teamId, milestones }) => {
      try {
        // Validate description length
        if (description.length > 255) {
          return {
            success: false,
            error: `Description is too long (${description.length} characters). The description field must be 255 characters or less.`,
            suggestion: `Use the "content" field for detailed documentation. Here's a truncated description: "${description.substring(0, 252)}..."`,
            tip: 'The description is a brief summary shown in project lists. Put detailed information in the content field.',
          };
        }

        const project = await LinearAPI.createProject({
          name,
          description,
          content: content || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          teamId: teamId || undefined,
          milestones: milestones || undefined,
        });

        return {
          success: true,
          project,
          message: `Project "${name}" created successfully! View it at: ${project.url}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),
};

// Issue Planner Tools
export const linearIssueTools = {
  getProjectDetails: tool({
    name: 'get_project_details',
    description: 'Get complete project details including milestones and existing issues for decomposition',
    parameters: z.object({
      projectId: z.string().describe('The Linear project ID, URL, or slug (supports URLs like https://linear.app/simplsales/project/...)'),
    }),
    execute: async ({ projectId }) => {
      try {
        const parsedId = await parseProjectId(projectId);
        console.log(`Parsing project ID for details: "${projectId}" -> "${parsedId}"`);
        
        const [project, milestones, issues] = await Promise.all([
          LinearAPI.getProject(parsedId),
          LinearAPI.getProjectMilestones(parsedId),
          LinearAPI.getProjectIssues(parsedId),
        ]);

        if (!project) {
          return {
            success: false,
            error: 'Project not found',
            debug: {
              originalInput: projectId,
              parsedId: parsedId,
            },
          };
        }

        return {
          success: true,
          project,
          milestones,
          existingIssues: issues,
        };
      } catch (error) {
        const parsedId = await parseProjectId(projectId);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: {
            originalInput: projectId,
            parsedId: parsedId,
          },
        };
      }
    },
  }),

  listProjectIssues: tool({
    name: 'list_project_issues',
    description: 'List all main issues in a project (excluding sub-issues). Use this to see the current project breakdown.',
    parameters: z.object({
      projectId: z.string().describe('The Linear project ID, URL, or slug to list issues for'),
    }),
    execute: async ({ projectId }) => {
      try {
        const parsedId = await parseProjectId(projectId);
        console.log(`Parsing project ID for issues: "${projectId}" -> "${parsedId}"`);
        
        const issues = await LinearAPI.getProjectIssues(parsedId);
        
        return {
          success: true,
          issues: issues.map(issue => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            state: issue.state,
            priority: issue.priority,
            estimate: issue.estimate,
            assignee: issue.assignee,
            url: issue.url,
          })),
          totalCount: issues.length,
          message: `Found ${issues.length} main issue(s) in the project`,
        };
      } catch (error) {
        const parsedId = await parseProjectId(projectId);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          issues: [],
          debug: {
            originalInput: projectId,
            parsedId: parsedId,
          },
        };
      }
    },
  }),

  listIssueSubIssues: tool({
    name: 'list_issue_sub_issues',
    description: 'List all sub-issues for a specific parent issue. Use this to see how an issue has been broken down.',
    parameters: z.object({
      issueId: z.string().describe('The parent issue ID to list sub-issues for'),
    }),
    execute: async ({ issueId }) => {
      try {
        const subIssues = await LinearAPI.getIssueSubIssues(issueId);
        
        return {
          success: true,
          subIssues: subIssues.map(issue => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            state: issue.state,
            priority: issue.priority,
            estimate: issue.estimate,
            assignee: issue.assignee,
            url: issue.url,
          })),
          totalCount: subIssues.length,
          message: `Found ${subIssues.length} sub-issue(s) for the parent issue`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          subIssues: [],
        };
      }
    },
  }),

  getTeamInfo: tool({
    name: 'get_team_info',
    description: 'Get team information including workflow states and labels for issue creation',
    parameters: z.object({
      teamId: z.string().describe('The team ID to get information for'),
    }),
    execute: async ({ teamId }) => {
      try {
        const [team, workflowStates, labels] = await Promise.all([
          LinearAPI.getTeam(teamId),
          LinearAPI.getWorkflowStates(teamId),
          LinearAPI.getTeamLabels(teamId),
        ]);

        if (!team) {
          return {
            success: false,
            error: 'Team not found',
          };
        }

        return {
          success: true,
          team,
          workflowStates,
          labels,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),

  bulkCreateIssues: tool({
    name: 'bulk_create_issues',
    description: 'Create Linear issues with sub-issues and milestones. This is the ONLY tool for creating issues. Use Engineering team (ID: 20d21f17-a171-43ad-b265-a68ee95b7575) unless specifically told otherwise.',
    parameters: z.object({
      issues: z.array(z.object({
        title: z.string().describe('Issue title'),
        description: z.string().describe('Issue description in markdown'),
        teamId: z.string().describe('Team ID (default: 20d21f17-a171-43ad-b265-a68ee95b7575 for Engineering)'),
        projectId: z.string().optional().nullable().describe('Project ID'),
        priority: z.number().optional().nullable().describe('Priority level'),
        estimate: z.number().optional().nullable().describe('Estimate in points'),
        labels: z.array(z.string()).optional().nullable().describe('Label IDs'),
        assigneeId: z.string().optional().nullable().describe('Assignee ID'),
        stateId: z.string().optional().nullable().describe('State ID'),
        projectMilestoneId: z.string().describe('Project milestone ID - REQUIRED for all issues'),
        subIssues: z.array(z.object({
          title: z.string(),
          description: z.string(),
          estimate: z.number().optional().nullable(),
          priority: z.number().optional().nullable(),
          assigneeId: z.string().optional().nullable(),
          projectMilestoneId: z.string().optional().nullable(),
        })).describe('Sub-issues to create as children - REQUIRED, every main issue must have at least one sub-issue'),
      })).describe('Array of issues to create'),
    }),
    needsApproval: true, // Creating issues should require approval
    execute: async ({ issues }) => {
      try {
        const createdIssues = [];
        const errors = [];

        for (const issueData of issues) {
          try {
            // Validate that issue has sub-issues
            if (!issueData.subIssues || issueData.subIssues.length === 0) {
              errors.push(`Issue "${issueData.title}" must have at least one sub-issue`);
              continue;
            }

            // Validate that issue has milestone
            if (!issueData.projectMilestoneId) {
              errors.push(`Issue "${issueData.title}" must have a projectMilestoneId`);
              continue;
            }

            // Create main issue
            const mainIssue = await LinearAPI.createIssue({
              title: issueData.title,
              description: issueData.description,
              teamId: issueData.teamId,
              projectId: issueData.projectId || undefined,
              priority: issueData.priority || undefined,
              estimate: issueData.estimate || undefined,
              labels: issueData.labels || undefined,
              assigneeId: issueData.assigneeId || undefined,
              stateId: issueData.stateId || undefined,
              projectMilestoneId: issueData.projectMilestoneId,
            });

            createdIssues.push(mainIssue);

            // Create sub-issues with proper parent relationship
            for (const subIssueData of issueData.subIssues) {
              try {
                const subIssue = await LinearAPI.createIssue({
                  title: subIssueData.title,
                  description: subIssueData.description,
                  teamId: issueData.teamId,
                  projectId: issueData.projectId || undefined,
                  estimate: subIssueData.estimate || undefined,
                  priority: subIssueData.priority || undefined,
                  assigneeId: subIssueData.assigneeId || undefined,
                  labels: issueData.labels || undefined, // Inherit parent labels
                  stateId: issueData.stateId || undefined,
                  parentId: mainIssue.id, // Set parent relationship
                  projectMilestoneId: subIssueData.projectMilestoneId || issueData.projectMilestoneId, // Use sub-issue milestone or inherit from parent
                });
                createdIssues.push(subIssue);
              } catch (subError) {
                errors.push(`Failed to create sub-issue "${subIssueData.title}": ${subError instanceof Error ? subError.message : 'Unknown error'}`);
              }
            }
          } catch (error) {
            errors.push(`Failed to create issue "${issueData.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return {
          success: true,
          createdIssues,
          errors: errors.length > 0 ? errors : undefined,
          message: `Successfully created ${createdIssues.length} issues${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),

  searchTeam: tool({
    name: 'search_team',
    description: 'Search for a team by name or key to get the team ID',
    parameters: z.object({
      identifier: z.string().describe('Team name, key, or ID to search for'),
    }),
    execute: async ({ identifier }) => {
      try {
        const team = await LinearAPI.getTeam(identifier);
        if (!team) {
          return {
            success: false,
            error: 'Team not found',
          };
        }
        return {
          success: true,
          team,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),

  updateProject: tool({
    name: 'update_project',
    description: 'Update an existing Linear project. Use "description" for brief summary (max 255 chars) and "content" for detailed documentation.',
    parameters: z.object({
      projectId: z.string().describe('The project ID to update'),
      name: z.string().optional().nullable().describe('New project name'),
      description: z.string().optional().nullable().describe('New brief summary (max 255 characters)'),
      content: z.string().optional().nullable().describe('New detailed documentation in markdown format (no length limit)'),
      targetDate: z.string().optional().nullable().describe('New target date in ISO format (YYYY-MM-DD)'),
    }),
    needsApproval: true, // Updating projects should require approval
    execute: async ({ projectId, name, description, content, targetDate }) => {
      try {
        // Validate description length if provided
        if (description && description.length > 255) {
          return {
            success: false,
            error: `Description is too long (${description.length} characters). The description field must be 255 characters or less.`,
            suggestion: `Use the "content" field for detailed documentation. Here's a truncated description: "${description.substring(0, 252)}..."`,
            tip: 'The description is a brief summary shown in project lists. Put detailed information in the content field.',
          };
        }

        const project = await LinearAPI.updateProject({
          projectId,
          name: nullToUndefined(name),
          description: nullToUndefined(description),
          content: nullToUndefined(content),
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        });

        return {
          success: true,
          project,
          message: `Project "${project.name}" updated successfully! View it at: ${project.url}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),

  getIssue: tool({
    name: 'get_issue',
    description: 'Get detailed information about a specific Linear issue by ID',
    parameters: z.object({
      issueId: z.string().describe('The Linear issue ID'),
    }),
    execute: async ({ issueId }) => {
      try {
        const issue = await LinearAPI.getIssue(issueId);
        if (!issue) {
          return {
            success: false,
            error: 'Issue not found',
          };
        }
        return {
          success: true,
          issue,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),

  updateIssue: tool({
    name: 'update_issue',
    description: 'Update an existing Linear issue',
    parameters: z.object({
      issueId: z.string().describe('The issue ID to update'),
      title: z.string().optional().nullable().describe('New issue title'),
      description: z.string().optional().nullable().describe('New issue description in markdown'),
      priority: z.number().optional().nullable().describe('New priority level (0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low)'),
      estimate: z.number().optional().nullable().describe('New estimate in points (1=XS, 2=S, 3=M, 5=L, 8=XL, 13=XXL, 21=XXXL)'),
      labels: z.array(z.string()).optional().nullable().describe('Array of label IDs to assign'),
      assigneeId: z.string().optional().nullable().describe('User ID to assign the issue to'),
      stateId: z.string().optional().nullable().describe('Workflow state ID'),
    }),
    needsApproval: async (_context, { priority }) => {
      // Only require approval for high priority issues
      return priority !== undefined && (priority === 1 || priority === 2);
    },
    execute: async ({ issueId, title, description, priority, estimate, labels, assigneeId, stateId }) => {
      try {
        const issue = await LinearAPI.updateIssue({
          issueId,
          title: nullToUndefined(title),
          description: nullToUndefined(description),
          priority: nullToUndefined(priority),
          estimate: nullToUndefined(estimate),
          labels: nullToUndefined(labels),
          assigneeId: nullToUndefined(assigneeId),
          stateId: nullToUndefined(stateId),
        });

        return {
          success: true,
          issue,
          message: `Issue "${issue.title}" (${issue.identifier}) updated successfully! View it at: ${issue.url}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),

  searchIssues: tool({
    name: 'search_issues',
    description: 'Search for issues by title or description',
    parameters: z.object({
      query: z.string().describe('Search query to find issues'),
      teamId: z.string().optional().nullable().describe('Optional team ID to filter by'),
    }),
    execute: async ({ query, teamId }) => {
      try {
        const issues = await LinearAPI.searchIssues(query, nullToUndefined(teamId));
        return {
          success: true,
          issues,
          message: `Found ${issues.length} issues matching "${query}"`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }),
};

// Combined tools for both agents
export const allLinearTools = {
  ...linearProjectTools,
  ...linearIssueTools,
};

// Helper function to get tools based on agent type
export function getLinearToolsForAgent(agentType: 'project_planner' | 'issue_planner') {
  switch (agentType) {
    case 'project_planner':
      return Object.values(linearProjectTools);
    case 'issue_planner':
      return Object.values(linearIssueTools);
    default:
      return Object.values(allLinearTools);
  }
} 