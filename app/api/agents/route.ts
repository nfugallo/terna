import { NextRequest } from 'next/server';
import { run, RunState, Agent } from '@openai/agents';
import { 
  createProjectPlannerAgent, 
  createIssuePlannerAgent, 
  createCodeWriterAgent,
  createLinearProjectPlannerAgent,
  createLinearIssuePlannerAgent
} from '@/lib/agents/agents';

// Agent selection logic based on message content
async function selectAgent(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Keywords for Linear project planning
  if (lowerMessage.includes('linear') && (
      lowerMessage.includes('project') || 
      lowerMessage.includes('milestone') ||
      lowerMessage.includes('create project'))) {
    return await createLinearProjectPlannerAgent();
  }
  
  // Keywords for Linear issue planning
  if (lowerMessage.includes('linear') && (
      lowerMessage.includes('issue') || 
      lowerMessage.includes('task') || 
      lowerMessage.includes('ticket') ||
      lowerMessage.includes('sub-issue') ||
      lowerMessage.includes('decompose'))) {
    return await createLinearIssuePlannerAgent();
  }
  
  // Keywords for code writing
  if (lowerMessage.includes('write code') || 
      lowerMessage.includes('create file') || 
      lowerMessage.includes('generate code') ||
      lowerMessage.includes('commit') ||
      lowerMessage.includes('pull request') ||
      lowerMessage.includes('github') ||
      lowerMessage.includes('repository')) {
    return await createCodeWriterAgent();
  }
  
  // Keywords for issue planning
  if (lowerMessage.includes('issue') || 
      lowerMessage.includes('task') || 
      lowerMessage.includes('ticket') ||
      lowerMessage.includes('bug') ||
      lowerMessage.includes('feature request')) {
    return await createIssuePlannerAgent();
  }
  
  // Default to project planner
  return await createLinearProjectPlannerAgent();
}

export async function POST(request: NextRequest) {
  try {
    // Check if API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error('No OpenAI API key found');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured',
        details: 'Please set OPENAI_API_KEY in your .env.local file. Run "node setup-env.js" to create the file.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if API key has correct format
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.error('Invalid API key format');
      return new Response(JSON.stringify({ 
        error: 'Invalid API key format',
        details: 'Your API key should start with "sk-". You may have used an organization ID instead. Get your API key from https://platform.openai.com/api-keys'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { message, history: previousHistory, state: serializedState, approvals, githubToken, selectedAgent: selectedAgentName } = body;
    
    // Select appropriate agent
    let agent: Agent;
    
    // Use the explicitly selected agent if provided, otherwise select based on message
    switch (selectedAgentName) {
      case 'project-planner':
        agent = await createLinearProjectPlannerAgent();
        break;
      case 'issue-planner':
        agent = await createLinearIssuePlannerAgent();
        break;
      case 'linear-project-planner':
        agent = await createLinearProjectPlannerAgent();
        break;
      case 'linear-issue-planner':
        agent = await createLinearIssuePlannerAgent();
        break;
      case 'code-writer':
        agent = await createCodeWriterAgent();
        break;
      default:
        // Fall back to automatic selection if no/invalid agent is specified
        agent = await selectAgent(message);
        break;
    }
    
    // Create context with GitHub token if available
    const context = githubToken ? { github_token: githubToken } : undefined;
    
    let runInput: any;

    // If serializedState and approvals are present, we are continuing an interrupted run.
    if (serializedState && approvals) {
      const state = await RunState.fromString(agent, serializedState);
      
      for (const approval of approvals) {
        if (approval.approved) {
          state.approve(approval.interruption);
        } else {
          state.reject(approval.interruption);
        }
      }
      runInput = state;
    } else {
      // For a standard conversational turn, build on the history.
      const history = previousHistory || [];
      if (message) {
        history.push({ role: 'user', content: message });
      }
      runInput = history;
    }
    
    // Run the agent with streaming and context
    const result = await run(agent, runInput, { 
      stream: true,
      context 
    });
    
    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial agent info
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'agent_info', 
            agent: agent.name 
          })}\n\n`));

          // Stream events and text together
          for await (const event of result) {
            // Send raw events for debugging (filtered)
            if (event.type === 'raw_model_stream_event') {
              // Check if this event contains text delta
              if (event.data?.type === 'output_text_delta' && event.data?.delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'text', 
                  content: event.data.delta 
                })}\n\n`));
              }
            }
            
            // Send tool events
            if (event.type === 'run_item_stream_event' && event.item.type === 'tool_call_item') {
              const toolCallItem = event.item as { rawItem: { name: string; arguments: unknown } };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'tool_call', 
                tool: toolCallItem.rawItem.name,
                arguments: toolCallItem.rawItem.arguments
              })}\n\n`));
            }
            
            // Send tool results
            if (event.type === 'run_item_stream_event' && event.item.type === 'tool_call_output_item') {
              const toolOutputItem = event.item as { output: unknown };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'tool_result', 
                output: toolOutputItem.output
              })}\n\n`));
            }
          }

          // Wait for completion
          await result.completed;
          
          // Send final result with any interruptions and the full history
          const finalData = {
            type: 'complete',
            finalOutput: result.finalOutput,
            interruptions: result.interruptions,
            // Only send state if the run was actually interrupted
            state: result.interruptions.length > 0 ? JSON.stringify(result.state) : null,
            // Always send the full history for the client to manage
            history: result.history,
            finalAgent: agent.name,
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('Agent error:', error);
    const errorObj = error as Error & { code?: string; status?: number };
    
    // Handle specific OpenAI API errors
    if (errorObj.code === 'invalid_api_key') {
      return new Response(JSON.stringify({ 
        error: 'Invalid OpenAI API key',
        details: 'The API key provided is invalid. Please check your OPENAI_API_KEY in .env.local'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (errorObj.status === 401) {
      return new Response(JSON.stringify({ 
        error: 'Authentication failed',
        details: 'Please ensure your OpenAI API key is valid and has the necessary permissions'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      details: errorObj.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 