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
  content: any;
  timestamp: Date;
}

export default function DebugPage() {
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [selectedTab, setSelectedTab] = useState("logs");

  const handleDebugLog = (log: any) => {
    const newLog: DebugLog = {
      id: Date.now().toString(),
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
          if (log.type === "user_message") {
            return `## User (${log.content.model})\n${log.content.content}\n`;
          } else if (log.type === "assistant_response") {
            return `## Assistant\n${log.content.content}\n`;
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

  return (
    <main className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-black">
      <div className="h-full p-4">
        <div className="h-full glass-card overflow-hidden">
          <div className="h-full flex">
            {/* Main Content */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-light tracking-wide">Terna Debug</h1>
                  <p className="text-sm opacity-60 mt-1">Development & Debugging Interface</p>
                </div>
                <ThemeToggle />
              </div>
              
              {/* Chat Interface */}
              <div className="flex-1 overflow-hidden">
                <ChatInterface showDebugPanel={true} onDebugLog={handleDebugLog} />
              </div>
            </div>

            {/* Debug Panel */}
            <div className="w-96 border-l border-white/10 flex flex-col">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Debug Panel</h2>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="glass glass-hover h-8 w-8"
                      onClick={copyAllLogs}
                      title="Copy all logs"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="glass glass-hover h-8 w-8"
                      onClick={copyAsMarkdown}
                      title="Copy as Markdown"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="glass glass-hover h-8 w-8"
                      onClick={clearLogs}
                      title="Clear logs"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
                <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent">
                  <TabsTrigger value="logs" className="flex-1">Logs</TabsTrigger>
                  <TabsTrigger value="thinking" className="flex-1">Thinking</TabsTrigger>
                  <TabsTrigger value="tools" className="flex-1">Tools</TabsTrigger>
                </TabsList>

                <TabsContent value="logs" className="flex-1 m-0">
                  <ScrollArea className="h-full minimal-scrollbar">
                    <div className="p-4 space-y-2">
                      {debugLogs.map((log) => (
                        <div key={log.id} className="glass-card p-3 text-xs font-mono">
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-green-400">{log.type}</span>
                            <span className="opacity-50">{log.timestamp.toLocaleTimeString()}</span>
                          </div>
                          <pre className="whitespace-pre-wrap opacity-80 overflow-x-auto">
                            {typeof log.content === "object" 
                              ? JSON.stringify(log.content, null, 2)
                              : log.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="thinking" className="flex-1 m-0">
                  <ScrollArea className="h-full minimal-scrollbar">
                    <div className="p-4">
                      <p className="text-sm opacity-50 italic">
                        Agent thinking process will appear here...
                      </p>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="tools" className="flex-1 m-0">
                  <ScrollArea className="h-full minimal-scrollbar">
                    <div className="p-4">
                      <p className="text-sm opacity-50 italic">
                        Tool calls and responses will appear here...
                      </p>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 