"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Github, LogOut, FolderLock, CheckCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { validateGitHubToken } from "@/lib/agents/github-tool";

interface GitHubIntegrationProps {
  onTokenUpdate?: (token: string | null) => void;
}

export function GitHubIntegration({ onTokenUpdate }: GitHubIntegrationProps) {
  const { data: session, status } = useSession();
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateToken = useCallback(async (token: string) => {
    setIsValidating(true);
    try {
      const result = await validateGitHubToken(token);
      setTokenValid(result.valid);
      onTokenUpdate?.(result.valid ? token : null);
    } catch {
      setTokenValid(false);
      onTokenUpdate?.(null);
    } finally {
      setIsValidating(false);
    }
  }, [onTokenUpdate]);

  useEffect(() => {
    if (session?.accessToken) {
      validateToken(session.accessToken);
    }
  }, [session?.accessToken, validateToken]);



  if (status === "loading" || isValidating) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-60">
        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        Checking GitHub connection...
      </div>
    );
  }

  if (!session) {
    return (
      <Button
        onClick={() => signIn("github")}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Github className="h-4 w-4" />
        Connect GitHub
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        {tokenValid ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="opacity-80">GitHub connected</span>
            {session.user?.name && (
              <span className="font-medium">({session.user.name})</span>
            )}
          </>
        ) : (
          <>
            <FolderLock className="h-4 w-4 text-yellow-500" />
            <span className="opacity-80">Invalid token</span>
          </>
        )}
      </div>
      
      <Button
        onClick={() => signOut()}
        variant="ghost"
        size="sm"
        className="gap-2 h-8"
      >
        <LogOut className="h-3 w-3" />
        Disconnect
      </Button>
    </div>
  );
} 