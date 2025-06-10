# GitHub Integration Setup Guide

This guide will help you set up the GitHub integration for Terna, which allows the AI to write code to specific folders in your repositories with your approval.

## 1. Create a GitHub OAuth App

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the following details:
   - **Application name**: Terna Code Writer (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID**
6. Generate a new **Client Secret** and copy it immediately (you won't be able to see it again)

## 2. Configure Environment Variables

Create a `.env.local` file in your project root with the following:

```bash
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# GitHub OAuth App Configuration
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

To generate a secure `NEXTAUTH_SECRET`, run:
```bash
openssl rand -base64 32
```

## 3. Set Up Repository Protection (Recommended)

To ensure the AI can only write to specific folders, set up push rulesets:

1. Go to your repository on GitHub
2. Navigate to **Settings > Rules > Rulesets**
3. Click "New ruleset"
4. Configure the ruleset:
   - **Name**: "AI Folder Restrictions"
   - **Enforcement status**: Active
   - **Target branches**: Include default branch
   - **Rules**: 
     - Enable "Restrict file paths"
     - Add allowed paths (e.g., `ai-generated/**`, `docs/ai/**`)
     - Set to "Allow" for these paths
     - All other paths will be blocked by default

## 4. Create a Fine-Grained Personal Access Token (Alternative to OAuth)

If you prefer using a Personal Access Token instead of OAuth:

1. Go to [GitHub Settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click "Generate new token"
3. Set expiration and description
4. Under "Repository access", select only the repositories you want to allow
5. Under "Permissions", grant:
   - **Contents**: Write
   - **Pull requests**: Write
   - **Metadata**: Read (automatically selected)
6. Click "Generate token" and copy it

## 5. Using the Integration

Once set up, the Code Writer agent can:

1. **Create files** only in allowed folders
2. **Open pull requests** for review
3. **Require your approval** before any changes are made

### Example Usage

When chatting with the AI, you can say:

```
"Create a new React component for a todo list in the ai-generated folder of my repo username/reponame"
```

The AI will:
1. Ask for your approval to write the files
2. Create a new branch
3. Commit the files to the allowed folder
4. Open a pull request for your review

## Security Features

- ✅ **Folder Restrictions**: AI can only write to explicitly allowed folders
- ✅ **Pull Request Only**: All changes go through PRs, never direct commits
- ✅ **Manual Approval**: Every change requires your explicit approval
- ✅ **Token Scoping**: Minimal permissions granted
- ✅ **Repository Isolation**: Access limited to specific repositories

## Troubleshooting

### "Missing GitHub authentication" error
- Ensure you're signed in via the GitHub OAuth flow
- Check that your token has the required scopes

### "Repository not found" error
- Verify the repository exists and is accessible
- Check that your token/OAuth app has access to the repository

### "Permission denied" error
- Ensure your token has `repo` scope
- Verify you have write access to the repository

### Files rejected by GitHub
- Check your push ruleset configuration
- Ensure files are being written to allowed folders only 