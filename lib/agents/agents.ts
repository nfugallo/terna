import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { commitToFolder } from './github-tool';
import { getLinearToolsForAgent } from './linear-tools';

// Read system prompts from markdown files
async function loadSystemPrompt(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'lib', 'agents', filename);
  return await fs.readFile(filePath, 'utf-8');
}

// Define tools with approval requirements
const createProjectTool = tool({
  name: 'create_project',
  description: 'Create a new project with the given details',
  parameters: z.object({
    name: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
  }),
  needsApproval: true, // Always requires approval
  execute: async ({ name, description, technologies }) => {
    // Placeholder implementation
    return `Project "${name}" created successfully with technologies: ${technologies.join(', ')}`;
  },
});

const createIssueTool = tool({
  name: 'create_issue',
  description: 'Create a new issue/task',
  parameters: z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    labels: z.array(z.string()),
  }),
  needsApproval: async (_context, { priority }) => {
    // Only require approval for high priority issues
    return priority === 'high' || priority === 'critical';
  },
  execute: async ({ title, description, priority, labels }) => {
    // Placeholder implementation
    return `Issue "${title}" created with priority: ${priority} and labels: ${labels.join(', ')}`;
  },
});

const searchTool = tool({
  name: 'search_resources',
  description: 'Search for resources, documentation, or best practices',
  parameters: z.object({
    query: z.string(),
    type: z.enum(['documentation', 'tutorial', 'best-practice', 'example']),
  }),
  needsApproval: false, // No approval needed for searches
  execute: async ({ query, type }) => {
    // Placeholder implementation
    return `Found 5 ${type} resources for "${query}"`;
  },
});

// Create agents
export async function createProjectPlannerAgent() {
  const instructions = await loadSystemPrompt('project-planner.md');
  
  return new Agent({
    name: 'Project Planner',
    instructions,
    model: 'gpt-4.1',
    tools: [createProjectTool, searchTool],
  });
}

export async function createIssuePlannerAgent() {
  const instructions = await loadSystemPrompt('issue-planner.md');
  
  return new Agent({
    name: 'Issue Planner',
    instructions,
    model: 'gpt-4.1',
    tools: [createIssueTool, searchTool],
  });
}

export async function createCodeWriterAgent() {
  const instructions = `You are a Code Writer agent that helps users generate and commit code to GitHub repositories.

When the user asks you to generate or update code:
1. Use the commit_to_folder tool to write files to the specified allowed folder
2. Always respect the folder boundaries - only write to the allowed folder
3. Create well-structured, clean code following best practices
4. Include appropriate comments and documentation
5. Suggest meaningful PR titles and descriptions

Important security notes:
- You can ONLY write files within the allowed folder specified by the user
- All commits require user approval before being pushed
- Changes are made via pull requests, not direct commits to main

If the user hasn't connected their GitHub account yet, inform them they need to do so first.`;
  
  return new Agent({
    name: 'Code Writer',
    instructions,
    model: 'gpt-4.1',
    tools: [commitToFolder, searchTool],
  });
}

// Linear-specific agents
export async function createLinearProjectPlannerAgent() {
  const instructions = await loadSystemPrompt('project-planner.md');
  const linearTools = getLinearToolsForAgent('project_planner');
  
  return new Agent({
    name: 'Linear Project Planner',
    instructions: instructions + '\n\nYou have access to Linear tools to create and manage projects in Linear. Always use these tools when working with Linear projects.',
    model: 'gpt-4.1',
    tools: linearTools,
  });
}

export async function createLinearIssuePlannerAgent() {
  const instructions = await loadSystemPrompt('issue-planner.md');
  const linearTools = getLinearToolsForAgent('issue_planner');
  
  return new Agent({
    name: 'Linear Issue Planner',
    instructions: instructions + '\n\nYou have access to Linear tools to create and manage issues in Linear. Always use these tools when working with Linear issues.',
    model: 'gpt-4.1',
    tools: linearTools,
  });
} 