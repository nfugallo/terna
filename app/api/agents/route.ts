import { NextRequest } from 'next/server';
import { run, RunState } from '@openai/agents';
import { createTriageAgent } from '@/lib/agents/agents';

export async function POST(request: NextRequest) {
  try {
    const { message, state: serializedState, approvals } = await request.json();
    
    // Create the triage agent
    const agent = await createTriageAgent();
    
    // Handle state restoration and approvals if provided
    let runInput: any = message;
    if (serializedState) {
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
    
    // Run the agent with streaming
    const result = await run(agent, runInput, { stream: true });
    
    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream text content
          for await (const chunk of result.toTextStream()) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`));
          }
          
          // Wait for completion
          await result.completed;
          
          // Send final result with any interruptions
          const finalData = {
            type: 'complete',
            finalOutput: result.finalOutput,
            interruptions: result.interruptions,
            state: result.state ? JSON.stringify(result.state) : null,
            finalAgent: result.finalAgent?.name,
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
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
  } catch (error) {
    console.error('Agent error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 