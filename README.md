# AI Planning Assistants

An AI-powered planning application built with Next.js and the OpenAI Agents SDK. Features two specialized agents - Project Planner and Issue Planner - that help you plan software projects and manage tasks.

## Features

- **Project Planner Agent**: Helps break down requirements, suggest architecture, and create timelines
- **Issue Planner Agent**: Creates detailed issues, manages dependencies, and organizes work
- **Streaming Responses**: Real-time streaming of agent responses for better UX
- **Human-in-the-Loop**: Approval mechanism for sensitive tool calls
- **Agent Handoffs**: Intelligent routing between specialized agents

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your OpenAI API key:
   - Create a `.env.local` file in the root directory
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=sk-your-api-key-here
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Navigate to the chat interface by clicking "Start Planning" on the home page
2. Ask questions about project planning or issue management
3. The triage agent will automatically route your request to the appropriate specialist
4. When tools require approval (e.g., creating high-priority issues), you'll see an approval dialog

## Customizing Agent Prompts

You can customize the agent behaviors by editing:
- `lib/agents/project-planner.md` - Project Planner system prompt
- `lib/agents/issue-planner.md` - Issue Planner system prompt

## Tools

Currently implemented tools (with placeholder functionality):
- `create_project` - Creates a new project (always requires approval)
- `create_issue` - Creates issues/tasks (requires approval for high/critical priority)
- `search_resources` - Searches for documentation and resources (no approval needed)

## Architecture

- **Next.js App Router** for the web framework
- **OpenAI Agents SDK** for agent orchestration
- **Server-Sent Events (SSE)** for streaming responses
- **Zod** for schema validation
- **TypeScript** for type safety

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
