import { tool, RunContext } from '@openai/agents';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

/** Schema the LLM must fill in */
const params = z.object({
  owner: z.string().describe('GitHub username or organization name'),
  repo: z.string().describe('Repository name'),
  baseBranch: z.string().default('main').describe('Base branch to create PR from'),
  allowedFolder: z.string().describe('The folder where files can be written (e.g. "ai-generated")'),
  files: z.array(
    z.object({
      path: z.string().describe('File path within the allowed folder'),
      content: z.string().describe('File content as UTF-8 string'),
    })
  ).describe('Files to create or update'),
  prTitle: z.string().default('AI: add generated code').describe('Pull request title'),
  prDescription: z.string().nullable().optional().describe('Pull request description'),
});

type Args = z.infer<typeof params>;

export const commitToFolder = tool<typeof params>({
  name: 'commit_to_folder',
  description:
    'Write or update files inside a single whitelisted folder and open a pull request. ' +
    'This tool requires approval before execution and will only write to the specified folder.',
  parameters: params,
  
  /** Block every call until user clicks Approve in your UI */
  needsApproval: true,

  /** Actual business logic */
  execute: async (args: Args, ctx) => {
    const {
      owner,
      repo,
      baseBranch,
      allowedFolder,
      files,
      prTitle,
      prDescription,
    } = args;

    // 1. Runtime safety check - ensure all files are within allowed folder
    for (const f of files) {
      if (!f.path.startsWith(`${allowedFolder}/`)) {
        throw new Error(
          `Security violation: File "${f.path}" is outside allowed folder "${allowedFolder}/". ` +
          `All files must be within the allowed folder.`
        );
      }
    }

    // 2. Grab credential that was stored after OAuth / GitHub-App handshake
    // For now, we'll need to get the token from the environment or passed context
    const token = process.env.GITHUB_TOKEN || (ctx as any)?.github_token;
    if (!token) {
      // No token yet → need to authenticate
      throw new Error(
        'Missing GitHub authentication. Please connect your GitHub account first. ' +
        'Go to Settings → Integrations → GitHub to connect your account.'
      );
    }

    const octokit = new Octokit({ auth: token });

    try {
      // 3. Create a short-lived branch off base branch
      const branchName = `ai/generated-${Date.now()}`;
      
      // Get the base branch SHA
      const { data: baseRef } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });
      const baseSha = baseRef.object.sha;

      // Create new branch
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      // 4. Get the base tree
      const { data: baseCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: baseSha,
      });
      const baseTreeSha = baseCommit.tree.sha;

      // 5. Create blobs for each file
      const treeItems = await Promise.all(
        files.map(async ({ path, content }) => {
          const { data: blob } = await octokit.git.createBlob({
            owner,
            repo,
            content,
            encoding: 'utf-8',
          });
          return {
            path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      // 6. Create a new tree with the files
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: treeItems,
      });

      // 7. Create commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: prTitle,
        tree: newTree.sha,
        parents: [baseSha],
      });

      // 8. Update branch reference
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: newCommit.sha,
      });

      // 9. Open PR
      const { data: pr } = await octokit.pulls.create({
        owner,
        repo,
        head: branchName,
        base: baseBranch,
        title: prTitle,
        body:
          prDescription ||
          `This pull request was generated automatically by the OpenAI agent.\n\n` +
          `**Files modified:**\n${files.map(f => `- ${f.path}`).join('\n')}\n\n` +
          `All changes are restricted to the \`${allowedFolder}/\` folder.`,
      });

      return {
        success: true,
        message: `Pull request created successfully!`,
        prUrl: pr.html_url,
        prNumber: pr.number,
        branch: branchName,
        filesModified: files.length,
      };
    } catch (error: any) {
      // Handle specific GitHub API errors
      if (error.status === 404) {
        throw new Error(
          `Repository "${owner}/${repo}" not found or you don't have access. ` +
          `Please ensure the repository exists and your GitHub token has the necessary permissions.`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Permission denied. Please ensure your GitHub token has 'repo' scope and ` +
          `you have write access to "${owner}/${repo}".`
        );
      } else if (error.status === 422) {
        throw new Error(
          `Invalid request: ${error.message}. ` +
          `This might be due to branch protection rules or invalid file paths.`
        );
      }
      
      throw new Error(`GitHub API error: ${error.message || 'Unknown error'}`);
    }
  },
});

// Helper function to validate GitHub token permissions
export async function validateGitHubToken(token: string): Promise<{
  valid: boolean;
  username?: string;
  scopes?: string[];
  error?: string;
}> {
  try {
    const octokit = new Octokit({ auth: token });
    
    // Check token validity and get user info
    const { data: user, headers } = await octokit.users.getAuthenticated();
    
    // Extract scopes from headers
    const scopes = headers['x-oauth-scopes']?.split(', ') || [];
    
    // Check if token has required scopes
    const hasRequiredScopes = scopes.includes('repo') || scopes.includes('public_repo');
    
    if (!hasRequiredScopes) {
      return {
        valid: false,
        username: user.login,
        scopes,
        error: 'Token missing required "repo" scope',
      };
    }
    
    return {
      valid: true,
      username: user.login,
      scopes,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid token',
    };
  }
} 