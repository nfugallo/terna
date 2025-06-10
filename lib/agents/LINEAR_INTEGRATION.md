# Linear Integration for Terna

This directory contains the Linear integration for the Terna project, allowing agents to interact with Linear for project and issue management.

## Setup

1. **Install Dependencies**
   ```bash
   npm install @linear/sdk
   ```

2. **Set Linear API Key**
   Add your Linear API key to your `.env.local` file:
   ```
   LINEAR_API_KEY=your_linear_api_key_here
   ```

   You can get your API key from: https://linear.app/settings/api

## Available Agents

### Linear Project Planner
Creates and manages projects in Linear with milestones.

**Available Tools:**
- `search_projects` - Search for existing projects
- `list_all_projects` - List all projects with filtering options
- `get_project` - Get detailed project information
- `get_teams` - List all teams in the workspace
- `create_project` - Create new projects with milestones (requires approval)

### Linear Issue Planner
Decomposes projects into issues and sub-issues.

**Available Tools:**
- `get_project_details` - Get project with milestones and issues
- `list_project_issues` - List main issues in a project
- `list_issue_sub_issues` - List sub-issues for a parent issue
- `get_team_info` - Get team workflow states and labels
- `bulk_create_issues` - Create issues with sub-issues (requires approval)
- `search_team` - Find teams by name or key
- `update_project` - Update project details (requires approval)
- `get_issue` - Get issue details
- `update_issue` - Update issue (approval required for high priority)
- `search_issues` - Search issues by title or description

## Usage Examples

### Creating a Project
```
"Create a Linear project called 'New Feature' with milestones for design, implementation, and testing"
```

### Decomposing a Project
```
"Decompose the Linear project [project-url] into issues and sub-issues"
```

### Searching Projects
```
"Search for Linear projects related to authentication"
```

## Testing

Run the test files to verify the integration:

```bash
# Test Linear API connection
npm run test:linear-api

# Test Linear agents
npm run test:linear-agents
```

## Architecture

- `linear-client.ts` - Low-level Linear API wrapper
- `linear-tools.ts` - OpenAI SDK tool definitions
- `agents.ts` - Agent configurations with Linear tools
- `test-linear.ts` - API connection tests
- `test-linear-agents.ts` - Agent integration tests

## Security Notes

- All project/issue creation requires user approval
- High-priority issue updates require approval
- API key is stored securely in environment variables
- Tools validate input and handle errors gracefully 