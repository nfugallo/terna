import { NextRequest, NextResponse } from 'next/server';
import { GitHubTernaSync } from '@/lib/agents/github-terna-sync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, githubToken, action } = body;

    if (!owner || !repo || !githubToken) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, githubToken' },
        { status: 400 }
      );
    }

    const sync = new GitHubTernaSync({
      owner,
      repo,
      branch,
      githubToken,
    });

    if (action === 'download') {
      // Download terna folder from GitHub to local
      await sync.downloadTernaFolder();
      return NextResponse.json({
        success: true,
        message: 'Terna folder downloaded successfully',
      });
    } else {
      // Sync from GitHub to Linear
      const result = await sync.syncFromGitHub();
      return NextResponse.json({
        success: true,
        ...result,
      });
    }
  } catch (error) {
    console.error('GitHub sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 