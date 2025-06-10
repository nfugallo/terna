import ChatInterface from "./components/ChatInterface";
import { ThemeToggle } from "./components/theme-toggle";

export default function Home() {
  return (
    <main className="h-screen bg-white dark:bg-black overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between backdrop-blur-sm flex-shrink-0">
          <div>
            <h1 className="text-2xl font-light tracking-wide text-black dark:text-white">Terna</h1>
            <p className="text-sm opacity-60 mt-1 text-black dark:text-white">The Agentic Interface for the Codex Era</p>
          </div>
          <ThemeToggle />
        </div>
        
        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden min-h-0">
          <ChatInterface />
        </div>
      </div>
    </main>
  );
}
