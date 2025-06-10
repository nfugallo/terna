"use client";

import { useState } from "react";
import ChatInterface from "../components/ChatInterface";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, Trash2 } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";

interface DebugLog {
  id: string;
  type: string;
  content: unknown;
  timestamp: Date;
}

export default function DebugPage() {
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [selectedTab, setSelectedTab] = useState("logs");

  const handleDebugLog = (log: { type: string; content: unknown; timestamp: Date }) => {
    const newLog: DebugLog = {
      id: `${Date.now()}-${Math.random()}`,
      ...log,
    };
    setDebugLogs((prev) => [...prev, newLog]);
  };

  const copyAllLogs = () => {
    const logsText = debugLogs
      .map((log) => `[${log.timestamp.toISOString()}] ${log.type}: ${JSON.stringify(log.content)}`)
      .join("\n");
    navigator.clipboard.writeText(logsText);
  };

  const copyAsMarkdown = () => {
    const markdown = `# Terna Debug Session - ${new Date().toISOString()}\n\n` +
      debugLogs
        .map((log) => {
          const content = log.content as any;
          if (log.type === "user_message") {
            return `## User (${content.model || 'unknown'})\n${content.content || ''}\n`;
          } else if (log.type === "assistant_response") {
            return `## Assistant\n${content.content || content || ''}\n`;
          } else {
            return `### ${log.type}\n\`\`\`json\n${JSON.stringify(log.content, null, 2)}\n\`\`\`\n`;
          }
        })
        .join("\n");
    navigator.clipboard.writeText(markdown);
  };

  const clearLogs = () => {
    setDebugLogs([]);
  };

  // Filter logs by type
  const thinkingLogs = debugLogs.filter(log => log.type === 'thinking' || log.type === 'agent_selected');
  const toolLogs = debugLogs.filter(log => log.type === 'tool_call' || log.type === 'tool_result');

  return (
    <main className="h-screen bg-white dark:bg-black overflow-hidden">
      <div className="h-full flex">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between backdrop-blur-sm flex-shrink-0">
            <div>
              <h1 className="text-2xl font-light tracking-wide text-black dark:text-white">Terna Debug</h1>
              <p className="text-sm opacity-60 mt-1 text-black dark:text-white">Development & Debugging Interface</p>
            </div>
            <ThemeToggle />
          </div>
          
          {/* Chat Interface */}
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatInterface showDebugPanel={true} onDebugLog={handleDebugLog} />
          </div>
        </div>

        {/* Debug Panel */}
        <div className="w-96 border-l border-black/10 dark:border-white/10 flex flex-col bg-white/50 dark:bg-black/50 backdrop-blur-sm min-h-0">
          <div className="p-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-black dark:text-white">Debug Panel</h2>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={copyAllLogs}
                  title="Copy all logs"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={copyAsMarkdown}
                  title="Copy as Markdown"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={clearLogs}
                  title="Clear logs"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full rounded-none border-b border-black/10 dark:border-white/10 bg-transparent flex-shrink-0">
              <TabsTrigger value="logs" className="flex-1 data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                Logs ({debugLogs.length})
              </TabsTrigger>
              <TabsTrigger value="thinking" className="flex-1 data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                Thinking ({thinkingLogs.length})
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex-1 data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                Tools ({toolLogs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="flex-1 m-0 min-h-0">
              <ScrollArea className="h-full minimal-scrollbar">
                <div className="p-4 space-y-2">
                  {debugLogs.map((log) => (
                    <div key={log.id} className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-3 text-xs font-mono">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-black dark:text-white font-semibold">{log.type}</span>
                        <span className="opacity-50">{log.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <pre className="whitespace-pre-wrap opacity-80 overflow-x-auto text-black dark:text-white">
                        {typeof log.content === "object" 
                          ? JSON.stringify(log.content, null, 2)
                          : String(log.content)}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="thinking" className="flex-1 m-0 min-h-0">
              <ScrollArea className="h-full minimal-scrollbar">
                <div className="p-4 space-y-2">
                  {thinkingLogs.length === 0 ? (
                    <p className="text-sm opacity-50 italic text-black dark:text-white">
                      Agent thinking process will appear here...
                    </p>
                  ) : (
                    thinkingLogs.map((log) => (
                      <div key={log.id} className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-3 text-xs font-mono">
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-purple-600 dark:text-purple-400 font-semibold">{log.type}</span>
                          <span className="opacity-50">{log.timestamp.toLocaleTimeString()}</span>
                        </div>
                        <pre className="whitespace-pre-wrap opacity-80 overflow-x-auto text-black dark:text-white">
                          {typeof log.content === "object" 
                            ? JSON.stringify(log.content, null, 2)
                            : String(log.content)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tools" className="flex-1 m-0 min-h-0">
              <ScrollArea className="h-full minimal-scrollbar">
                <div className="p-4 space-y-2">
                  {toolLogs.length === 0 ? (
                    <p className="text-sm opacity-50 italic text-black dark:text-white">
                      Tool calls and responses will appear here...
                    </p>
                  ) : (
                    toolLogs.map((log) => (
                      <div key={log.id} className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-3 text-xs font-mono">
                        <div className="flex items-start justify-between mb-1">
                          <span className={`font-semibold ${
                            log.type === 'tool_call' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                          }`}>
                            {log.type === 'tool_call' ? '🔧 Tool Call' : '✅ Tool Result'}
                          </span>
                          <span className="opacity-50">{log.timestamp.toLocaleTimeString()}</span>
                        </div>
                        {log.type === 'tool_call' ? (
                          <div className="text-black dark:text-white">
                            <div className="text-yellow-700 dark:text-yellow-300 mb-1">Tool: {(log.content as any)?.tool || 'unknown'}</div>
                            <pre className="whitespace-pre-wrap opacity-80 overflow-x-auto">
                              {String((log.content as any)?.arguments || '')}
                            </pre>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap opacity-80 overflow-x-auto text-black dark:text-white">
                            {typeof log.content === "object" 
                              ? JSON.stringify(log.content, null, 2)
                              : String(log.content)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
} 