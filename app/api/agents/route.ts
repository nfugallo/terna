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
  return await createProjectPlannerAgent();
}

export async function POST(request: NextRequest) {
  console.log('API Route: Received request');
  
  try {
    // Check if API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error('API Route: No OpenAI API key found');
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
      console.error('API Route: Invalid API key format');
      return new Response(JSON.stringify({ 
        error: 'Invalid API key format',
        details: 'Your API key should start with "sk-". You may have used an organization ID instead. Get your API key from https://platform.openai.com/api-keys'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    console.log('API Route: Request body:', body);
    
    const { message, state: serializedState, approvals, githubToken, selectedAgent } = body;
    
    // Select appropriate agent based on selectedAgent parameter or message content
    console.log('API Route: Selecting agent...');
    let agent;
    
    if (serializedState) {
      // If we have state, use the same agent type that was used before
      agent = await createProjectPlannerAgent();
    } else if (selectedAgent) {
      // Use the explicitly selected agent
      console.log('API Route: Using selected agent:', selectedAgent);
      switch (selectedAgent) {
        case 'project-planner':
          agent = await createProjectPlannerAgent();
          break;
        case 'issue-planner':
          agent = await createIssuePlannerAgent();
          break;
        case 'linear-project-planner':
          agent = await createLinearProjectPlannerAgent();
          break;
        case 'linear-issue-planner':
          agent = await createLinearIssuePlannerAgent();
          break;
        default:
          console.log('API Route: Unknown selected agent, falling back to project planner');
          agent = await createProjectPlannerAgent();
      }
    } else {
      // Fall back to automatic selection based on message content
      agent = await selectAgent(message);
    }
    
    console.log('API Route: Agent selected:', agent.name);
    
    // Create context with GitHub token if available
    const context = githubToken ? { github_token: githubToken } : undefined;
    
    // Handle state restoration and approvals if provided
    let runInput: string | Awaited<ReturnType<typeof RunState.fromString>> = message;
    if (serializedState) {
      console.log('API Route: Restoring state...');
      const state = await RunState.fromString(agent, serializedState);
      
      // Apply approvals/rejections if provided
      if (approvals) {
        for (const approval of approvals) {
          if (approval.approved) {
            state.approve(approval.interruption);
          } else {
            state.reject(approval.interruption);
          }
        }
      }
      
      runInput = state;
    }
    
    // Run the agent with streaming and context
    console.log('API Route: Running agent with input:', runInput);
    const result = await run(agent, runInput, { 
      stream: true,
      context 
    });
    console.log('API Route: Agent run started');
    
    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        console.log('API Route: Stream started');
        try {
          // Send initial agent info
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'agent_info', 
            agent: agent.name 
          })}\n\n`));

          // Stream events and text together
          let eventCount = 0;
          for await (const event of result) {
            eventCount++;
            console.log(`API Route: Event ${eventCount}:`, event.type);
            
            // Send raw events for debugging
            if (event.type === 'raw_model_stream_event') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'debug_event', 
                eventType: event.type,
                data: event.data 
              })}\n\n`));
              
              // Check if this event contains text delta
              if (event.data?.type === 'output_text_delta' && event.data?.delta) {
                console.log('API Route: Text delta:', event.data.delta);
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

          console.log('API Route: Waiting for completion...');
          // Wait for completion
          await result.completed;
          console.log('API Route: Run completed');
          
          // Send final result with any interruptions
          const finalData = {
            type: 'complete',
            finalOutput: result.finalOutput,
            interruptions: result.interruptions,
            state: result.state ? JSON.stringify(result.state) : null,
            finalAgent: agent.name,
          };
          
          console.log('API Route: Sending final data:', finalData);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          console.log('API Route: Stream closed');
        } catch (error) {
          console.error('API Route: Streaming error:', error);
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
    console.error('API Route: Agent error:', error);
    const errorObj = error as Error & { code?: string; status?: number };
    console.error('API Route: Error stack:', errorObj.stack);
    
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