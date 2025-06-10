import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

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
    model: 'gpt-4o-mini',
    tools: [createProjectTool, searchTool],
  });
}

export async function createIssuePlannerAgent() {
  const instructions = await loadSystemPrompt('issue-planner.md');
  
  return new Agent({
    name: 'Issue Planner',
    instructions,
    model: 'gpt-4o-mini',
    tools: [createIssueTool, searchTool],
  });
}

// Create a triage agent that can hand off to specialized agents
export async function createTriageAgent() {
  const projectPlanner = await createProjectPlannerAgent();
  const issuePlanner = await createIssuePlannerAgent();
  
  return Agent.create({
    name: 'Triage Agent',
    instructions: `You are a triage agent that helps users by directing them to the appropriate specialized agent.
    
    - If the user wants to plan a project, create project structure, or discuss architecture, hand off to the Project Planner.
    - If the user wants to create issues, manage tasks, or organize work items, hand off to the Issue Planner.
    - Always be helpful and clarify the user's needs if unclear.`,
    model: 'gpt-4o-mini',
    handoffs: [projectPlanner, issuePlanner],
  });
} 