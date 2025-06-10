"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Github, Shield, FolderLock, GitPullRequest } from "lucide-react";
import { ThemeToggle } from "@/app/components/theme-toggle";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light tracking-wide text-black dark:text-white mb-2">
            Connect GitHub to Terna
          </h1>
          <p className="text-sm opacity-60 text-black dark:text-white">
            Securely connect your GitHub account with restricted folder access
          </p>
        </div>

        <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-black/10 dark:border-white/10 rounded-lg p-6 space-y-6">
          {/* Security Features */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-black dark:text-white flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Features
            </h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <FolderLock className="h-4 w-4 mt-0.5 opacity-60" />
                <div>
                  <p className="font-medium text-black dark:text-white">Folder-Restricted Access</p>
                  <p className="opacity-60 text-black dark:text-white">
                    AI can only write to folders you explicitly allow
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <GitPullRequest className="h-4 w-4 mt-0.5 opacity-60" />
                <div>
                  <p className="font-medium text-black dark:text-white">Pull Request Only</p>
                  <p className="opacity-60 text-black dark:text-white">
                    All changes are made via PRs, never direct commits
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 mt-0.5 opacity-60" />
                <div>
                  <p className="font-medium text-black dark:text-white">Manual Approval Required</p>
                  <p className="opacity-60 text-black dark:text-white">
                    Every code change requires your explicit approval
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions Requested */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-black dark:text-white">Permissions Requested:</h3>
            <ul className="text-sm space-y-1 opacity-60 text-black dark:text-white">
              <li>• Read access to your profile</li>
              <li>• Write access to repository contents</li>
              <li>• Create and manage pull requests</li>
            </ul>
          </div>

          {/* Sign In Button */}
          <Button
            onClick={() => signIn("github", { callbackUrl: "/chat" })}
            className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90"
          >
            <Github className="h-4 w-4 mr-2" />
            Connect with GitHub
          </Button>

          <p className="text-xs text-center opacity-50 text-black dark:text-white">
            By connecting, you agree to grant Terna the permissions listed above.
            You can revoke access at any time from your GitHub settings.
          </p>
        </div>

        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
} 