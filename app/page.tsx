import ChatInterface from "./components/ChatInterface";
import { ThemeToggle } from "./components/theme-toggle";

export default function Home() {
  return (
    <main className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-black">
      <div className="h-full p-4">
        <div className="h-full glass-card overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-light tracking-wide">Terna</h1>
                <p className="text-sm opacity-60 mt-1">The Agentic Interface for the Codex Era</p>
              </div>
              <ThemeToggle />
            </div>
            
            {/* Chat Interface */}
            <div className="flex-1 overflow-hidden">
              <ChatInterface />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
