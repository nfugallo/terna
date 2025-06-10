"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/app/components/theme-toggle";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The sign in link is no longer valid.",
    Default: "An error occurred during authentication.",
  };

  const message = errorMessages[error || "Default"] || errorMessages.Default;

  return (
    <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-3 text-red-500">
        <AlertCircle className="h-6 w-6" />
        <h1 className="text-xl font-medium">Authentication Error</h1>
      </div>
      
      <p className="text-sm opacity-80 text-black dark:text-white">
        {message}
      </p>

      <div className="flex gap-3">
        <Link href="/auth/signin" className="flex-1">
          <Button className="w-full" variant="outline">
            Try Again
          </Button>
        </Link>
        <Link href="/" className="flex-1">
          <Button className="w-full" variant="outline">
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Suspense fallback={
          <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle className="h-6 w-6" />
              <h1 className="text-xl font-medium">Authentication Error</h1>
            </div>
            <p className="text-sm opacity-80 text-black dark:text-white">
              Loading...
            </p>
            <div className="flex gap-3">
              <Link href="/auth/signin" className="flex-1">
                <Button className="w-full" variant="outline">
                  Try Again
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full" variant="outline">
                  Go Home
                </Button>
              </Link>
            </div>
          </div>
        }>
          <ErrorContent />
        </Suspense>

        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
} 