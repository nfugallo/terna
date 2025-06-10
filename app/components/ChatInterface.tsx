"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronLeft, Send } from "lucide-react";
import { GitHubIntegration } from "./GitHubIntegration";
import { useSession } from "next-auth/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agent?: string;
}

interface AgentInputItem {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

interface Interruption {
  agent: { name: string };
  rawItem: { name: string; arguments: string };
}

interface ApprovalRequest {
  interruptions: Interruption[];
  state: string;
}

// Helper function to format Project Draft JSON to Markdown
const formatProjectDraftToMarkdown = (data: any): string => {
  let md = `### ${data.name}\n\n`;
  if (data.targetQuarter) md += `**Target:** ${data.targetQuarter}\n\n`;
  if (data.description) md += `> ${data.description}\n\n`;

  if (data.milestones && data.milestones.length > 0) {
    md += `**Milestones:**\n`;
    md += data.milestones.map((m: any) => `- **${m.name}**: ${m.definitionOfDone}`).join('\n');
    md += '\n\n';
  }

  if (data.content) {
    md += '---\n\n';
    md += data.content;
  }

  return md;
};

// Helper function to format Issue Bundle JSON to Markdown
const formatIssueBundleToMarkdown = (data: any): string => {
  let md = '';
  if (data.issues && data.issues.length > 0) {
    data.issues.forEach((issue: any) => {
      md += `### ${issue.title}\n\n`;
      if (issue.estimate) md += `**Estimate:** ${issue.estimate}\n`;

      if (issue.labels) {
        md += `**Labels:** ${Object.entries(issue.labels).map(([key, value]) => `\`${key}: ${value}\``).join(' ')}\n\n`;
      }
      
      if (issue.description) {
        md += '---\n\n';
        md += issue.description + '\n\n';
      }

      if (issue.subIssues && issue.subIssues.length > 0) {
        md += `**Sub-issues:**\n`;
        md += issue.subIssues.map((s: any) => `- **${s.title}** (${s.estimate || 'N/A'})`).join('\n');
        md += '\n\n';
      }
    });
  }
  return md;
};

interface ChatInterfaceProps {
  showDebugPanel?: boolean;
  onDebugLog?: (log: { type: string; content: unknown; timestamp: Date }) => void;
}

export default function ChatInterface({ onDebugLog }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<"project-planner" | "issue-planner">("project-planner");
  const [showContent, setShowContent] = useState(false);
  const [contentText, setContentText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [history, setHistory] = useState<AgentInputItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, approvalRequest]);

  const prettyPrintArgs = (args: string) => {
    try {
      return JSON.stringify(JSON.parse(args), null, 2);
    } catch (e) {
      return args;
    }
  };

  const handleApproval = async (approvals: { interruption: Interruption; approved: boolean }[]) => {
    if (!approvalRequest) return;

    setApprovalRequest(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '',
          state: approvalRequest.state,
          approvals,
          githubToken: session?.accessToken,
          selectedAgent,
        }),
      });

      if (!response.ok) throw new Error('Failed to send approval');

      await handleStreamResponse(response);
    } catch (error) {
      console.error('Error handling approval:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing the approval.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamResponse = async (response: Response) => {
    // Check if response is JSON (error response)
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${errorData.error}\n\n${errorData.details || ''}`,
        timestamp: new Date(),
      }]);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let currentMessage = '';
    const messageId = Date.now().toString();
    let currentAgent = 'Assistant';

    if (!reader) {
      console.error('No reader available');
      return;
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      
      // Add chunk to buffer
      buffer += chunk;
      
      // Process complete lines
      const lines = buffer.split('\n');
      // Keep the last line in the buffer if it's incomplete
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // Handle different event types
            if (parsed.type === 'agent_info') {
              currentAgent = parsed.agent;
              if (onDebugLog) {
                onDebugLog({
                  type: 'agent_selected',
                  content: parsed.agent,
                  timestamp: new Date(),
                });
              }
            } else if (parsed.type === 'human_in_the_loop') {
              setApprovalRequest({
                interruptions: parsed.interruptions,
                state: parsed.state,
              });
            } else if (parsed.type === 'tool_call' && onDebugLog) {
              onDebugLog({
                type: 'tool_call',
                content: {
                  tool: parsed.tool,
                  arguments: parsed.arguments,
                },
                timestamp: new Date(),
              });
            } else if (parsed.type === 'tool_result' && onDebugLog) {
              onDebugLog({
                type: 'tool_result',
                content: parsed.output,
                timestamp: new Date(),
              });
            } else if (parsed.type === 'text') {
              currentMessage += parsed.content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessageIndex = newMessages.length - 1;
                const lastMessage = newMessages[lastMessageIndex];
                
                if (lastMessage && lastMessage.id === messageId) {
                  // Create a new message object instead of mutating the existing one
                  newMessages[lastMessageIndex] = {
                    ...lastMessage,
                    content: currentMessage
                  };
                } else {
                  newMessages.push({
                    id: messageId,
                    role: 'assistant',
                    content: currentMessage,
                    timestamp: new Date(),
                    agent: currentAgent,
                  });
                }
                
                return newMessages;
              });

              // Update content panel with task breakdown if agent provides it
              if (currentMessage.includes('Task Breakdown:') || currentMessage.includes('Issues:')) {
                setContentText(currentMessage);
              }
            } else if (parsed.type === 'complete') {
              const finalMessage = parsed.finalOutput || currentMessage;

              // Check for proposals in the final message
              const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
              const match = finalMessage.match(jsonRegex);

              if (match && match[1]) {
                  try {
                      const jsonData = JSON.parse(match[1]);
                      let markdownContent = '';

                      // Heuristic to check if it's a PROJECT DRAFT
                      if (jsonData.operation && jsonData.name && jsonData.milestones) {
                          markdownContent = formatProjectDraftToMarkdown(jsonData);
                      }
                      // Heuristic to check if it's an ISSUE BUNDLE
                      else if (jsonData.operation && jsonData.issues) {
                          markdownContent = formatIssueBundleToMarkdown(jsonData);
                      }

                      if (markdownContent) {
                          setContentText(markdownContent);
                          setShowContent(true);
                      }
                  } catch (e) {
                      console.error("Failed to parse proposal JSON from final message", e);
                  }
              }
              
              if (parsed.interruptions && parsed.interruptions.length > 0) {
                setApprovalRequest({
                  interruptions: parsed.interruptions,
                  state: parsed.state,
                });
              }
              if (parsed.history) {
                setHistory(parsed.history);
              }
              if (parsed.finalAgent) {
                currentAgent = parsed.finalAgent;
              }
              
              if (onDebugLog) {
                onDebugLog({
                  type: 'assistant_response',
                  content: finalMessage,
                  timestamp: new Date(),
                });
              }
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
            if (onDebugLog) {
              onDebugLog({
                type: 'error',
                content: { error: e, data: data },
                timestamp: new Date(),
              });
            }
          }
        }
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput("");
    setIsLoading(true);

    // Log for debug panel
    if (onDebugLog) {
      onDebugLog({
        type: "user_message",
        content: {
          content: input,
          agent: selectedAgent,
        },
        timestamp: new Date(),
      });
    }

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          history: history,
          githubToken: session?.accessToken,
          selectedAgent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to send message');
      }

      await handleStreamResponse(response);
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      const errorObj = error as Error;
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: errorObj.message || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full relative">
      {/* Main Chat Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          showContent ? "mr-96" : ""
        } min-h-0`}
      >
        {/* Agent Selection and GitHub Integration */}
        <div className="flex justify-between items-center p-4 flex-shrink-0">
          <div className="flex gap-2">
            <Badge
              variant={selectedAgent === "project-planner" ? "default" : "outline"}
              className={`cursor-pointer px-4 py-2 transition-all ${
                selectedAgent === "project-planner"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-white/10 dark:bg-white/5 backdrop-blur-md border-white/20 hover:bg-white/20 dark:hover:bg-white/10"
              }`}
              onClick={() => setSelectedAgent("project-planner")}
            >
              Project Planner
            </Badge>
            <Badge
              variant={selectedAgent === "issue-planner" ? "default" : "outline"}
              className={`cursor-pointer px-4 py-2 transition-all ${
                selectedAgent === "issue-planner"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-white/10 dark:bg-white/5 backdrop-blur-md border-white/20 hover:bg-white/20 dark:hover:bg-white/10"
              }`}
              onClick={() => setSelectedAgent("issue-planner")}
            >
              Issue Planner
            </Badge>
          </div>
          
          <GitHubIntegration onTokenUpdate={() => {}} />
        </div>

        {/* Messages */}
        <div className="flex-1 px-4 min-h-0 overflow-hidden">
          <ScrollArea className="h-full minimal-scrollbar">
            <div className="max-w-3xl mx-auto space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-4 max-w-[80%] rounded-lg backdrop-blur-md ${
                      message.role === "user"
                        ? "bg-black/80 text-white dark:bg-white/80 dark:text-black"
                        : "bg-white/80 text-black dark:bg-black/80 dark:text-white"
                    }`}
                  >
                    {message.agent && message.role === "assistant" && (
                      <div className="text-xs opacity-70 mb-1">{message.agent}</div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <span className="text-xs opacity-50 mt-2 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              
              {approvalRequest && (
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-black/20 dark:border-white/20 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Approval Required</h3>
                  {approvalRequest.interruptions.map((interruption, index) => (
                    <div key={index} className="mb-3">
                      <p className="text-sm">
                        <span className="font-medium">{interruption.agent.name}</span> wants to use{' '}
                        <span className="font-mono bg-black/10 dark:bg-white/10 px-1 rounded">{interruption.rawItem.name}</span>
                      </p>
                      <div className="text-xs opacity-70 mt-1">
                        Arguments:
                        <pre className="text-black dark:text-white text-xs bg-black/10 dark:bg-white/10 p-2 rounded mt-1 whitespace-pre-wrap break-words">
                          <code>
                            {prettyPrintArgs(interruption.rawItem.arguments)}
                          </code>
                        </pre>
                      </div>
                      <div className="mt-2 space-x-2">
                        <button
                          onClick={() => handleApproval([{ interruption, approved: true }])}
                          className="px-3 py-1 bg-black text-white dark:bg-white dark:text-black rounded text-sm hover:opacity-80 transition-opacity"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproval([{ interruption, approved: false }])}
                          className="px-3 py-1 bg-white text-black dark:bg-black dark:text-white border border-black dark:border-white rounded text-sm hover:opacity-80 transition-opacity"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="p-4 rounded-lg bg-white/80 dark:bg-black/80 backdrop-blur-md">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-black dark:bg-white rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-black dark:bg-white rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-black dark:bg-white rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-black/10 dark:border-white/10 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your task..."
              className="resize-none bg-white/80 dark:bg-black/80 backdrop-blur-md border-black/20 dark:border-white/20 text-black dark:text-white placeholder:text-black/50 dark:placeholder:text-white/50 focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
              rows={3}
              disabled={isLoading || !!approvalRequest}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !!approvalRequest}
              className="self-end bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Toggle Content Button */}
      <Button
        onClick={() => setShowContent(!showContent)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md hover:opacity-80 transition-opacity border-black/20 dark:border-white/20"
        size="icon"
        variant="ghost"
      >
        {showContent ? (
          <ChevronRight className="h-4 w-4 text-black dark:text-white" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-black dark:text-white" />
        )}
      </Button>

      {/* Content Panel */}
      {showContent && (
        <div className="absolute right-0 top-0 h-full w-96 p-4">
          <div className="h-full p-6 overflow-hidden rounded-lg bg-white/80 dark:bg-black/80 backdrop-blur-md flex flex-col">
            <h3 className="text-lg font-medium mb-4 text-black dark:text-white flex-shrink-0">Task Breakdown</h3>
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full minimal-scrollbar">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {contentText ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {contentText}
                    </ReactMarkdown>
                  ) : (
                    <p className="italic opacity-50">
                      Task breakdown will appear here as you discuss with the AI...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 