import ChatInterface from '@/components/chat/ChatInterface';

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold text-center py-4">AI Planning Assistants</h1>
        <p className="text-center text-gray-600 mb-4">
          Chat with our Project Planner and Issue Planner agents
        </p>
        <ChatInterface />
      </div>
    </main>
  );
} 