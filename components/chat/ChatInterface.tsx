'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
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
                    agent: currentAgent,
                  });
                }
                
                return newMessages;
              });
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

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
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.agent && (
                <div className="text-xs opacity-70 mb-1">{message.agent}</div>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        
        {approvalRequest && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Approval Required</h3>
            {approvalRequest.interruptions.map((interruption, index) => (
              <div key={index} className="mb-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{interruption.agent.name}</span> wants to use{' '}
                  <span className="font-mono bg-gray-100 px-1 rounded">{interruption.rawItem.name}</span>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Arguments: <code className="bg-gray-100 px-1 rounded">{interruption.rawItem.arguments}</code>
                </p>
                <div className="mt-2 space-x-2">
                  <button
                    onClick={() => handleApproval([{ interruption, approved: true }])}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApproval([{ interruption, approved: false }])}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading || !!approvalRequest}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim() || !!approvalRequest}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
} 