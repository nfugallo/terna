"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronLeft, Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agent?: string;
}

interface Interruption {
  agent: { name: string };
  rawItem: { name: string; arguments: string };
}

interface ApprovalRequest {
  interruptions: Interruption[];
  state: string;
}

interface ChatInterfaceProps {
  showDebugPanel?: boolean;
  onDebugLog?: (log: any) => void;
}

export default function ChatInterface({ showDebugPanel = false, onDebugLog }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<"gpt-4" | "claude-3.5">("gpt-4");
  const [showContent, setShowContent] = useState(false);
  const [contentText, setContentText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let currentMessage = '';
    let messageId = Date.now().toString();
    let currentAgent = 'Assistant';

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'text') {
              currentMessage += parsed.content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                
                if (lastMessage && lastMessage.id === messageId) {
                  lastMessage.content = currentMessage;
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
              if (parsed.interruptions && parsed.interruptions.length > 0) {
                setApprovalRequest({
                  interruptions: parsed.interruptions,
                  state: parsed.state,
                });
              }
              if (parsed.finalAgent) {
                currentAgent = parsed.finalAgent;
              }
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
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
        content: input,
        model: selectedModel,
        timestamp: new Date(),
      });
    }

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      await handleStreamResponse(response);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
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
        }`}
      >
        {/* Model Selection */}
        <div className="flex justify-center gap-2 p-4">
          <Badge
            variant={selectedModel === "gpt-4" ? "default" : "outline"}
            className={`cursor-pointer px-4 py-2 ${
              selectedModel === "gpt-4"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10 hover:bg-opacity-20 transition-all"
            }`}
            onClick={() => setSelectedModel("gpt-4")}
          >
            GPT-4
          </Badge>
          <Badge
            variant={selectedModel === "claude-3.5" ? "default" : "outline"}
            className={`cursor-pointer px-4 py-2 ${
              selectedModel === "claude-3.5"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10 hover:bg-opacity-20 transition-all"
            }`}
            onClick={() => setSelectedModel("claude-3.5")}
          >
            Claude 3.5
          </Badge>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 minimal-scrollbar">
          <div className="max-w-3xl mx-auto space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`p-4 max-w-[80%] rounded-lg shadow-lg border border-white/10 ${
                    message.role === "user"
                      ? "bg-white bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10"
                      : "bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10"
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
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 shadow-lg">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Approval Required</h3>
                {approvalRequest.interruptions.map((interruption, index) => (
                  <div key={index} className="mb-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{interruption.agent.name}</span> wants to use{' '}
                      <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{interruption.rawItem.name}</span>
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Arguments: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{interruption.rawItem.arguments}</code>
                    </p>
                    <div className="mt-2 space-x-2">
                      <button
                        onClick={() => handleApproval([{ interruption, approved: true }])}
                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval([{ interruption, approved: false }])}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
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
                <div className="p-4 rounded-lg shadow-lg bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10 border border-white/10">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10">
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
              className="resize-none bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10 border border-white/10 rounded-md px-3 py-2 focus:ring-2 focus:ring-white/20"
              rows={3}
              disabled={isLoading || !!approvalRequest}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !!approvalRequest}
              className="self-end bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10 hover:bg-opacity-20 border border-white/10"
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
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10 hover:bg-opacity-20 border border-white/10"
        size="icon"
        variant="ghost"
      >
        {showContent ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Content Panel */}
      {showContent && (
        <div className="absolute right-0 top-0 h-full w-96 m-4 p-6 overflow-hidden rounded-lg shadow-lg bg-gray-500 bg-clip-padding backdrop-filter backdrop-blur bg-opacity-10 border border-white/10">
          <ScrollArea className="h-full minimal-scrollbar">
            <div className="prose prose-invert max-w-none">
              <h3 className="text-lg font-medium mb-4">Task Breakdown</h3>
              <div className="space-y-4 text-sm opacity-80">
                {contentText || (
                  <p className="italic opacity-50">
                    Task breakdown will appear here as you discuss with the AI...
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
} 