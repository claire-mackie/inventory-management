# Claude Code Review Setup Guide

This guide walks you through setting up automated Claude code reviews on your GitHub repository.

## Overview

The Claude Code Review workflow automatically reviews code changes on every pull request using Anthropic's Claude API. It:

✅ Runs on all new PRs and updates  
✅ Analyzes code changes in Python, Vue, JavaScript, TypeScript, and JSON  
✅ Posts reviews directly to PR comments  
✅ Focuses on bugs, performance, best practices, and improvements  

## Prerequisites

- GitHub repository with Actions enabled
- Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
- A GitHub account with admin access to the repository

## Step-by-Step Setup

### 1. Workflow File (Already Created)

The workflow file is already in place at:
```
.github/workflows/claude-code-review.yml
```

### 2. Add Anthropic API Key to Secrets

1. Go to your repository settings
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name it: `ANTHROPIC_API_KEY`
5. Value: Your Anthropic API key (from [console.anthropic.com/account/keys](https://console.anthropic.com/account/keys))
6. Click **Add secret**

### 3. Enable GitHub Actions

1. Go to your repository
2. Click the **Actions** tab
3. Confirm GitHub Actions are enabled

### 4. Test It Out

1. Create a new branch: `git checkout -b test/claude-review`
2. Make a small code change (e.g., add a function or modify a variable)
3. Push and open a pull request
4. Wait for the workflow to run (~30 seconds)
5. Check the PR comments for Claude's review

## How It Works

**Trigger:** When a PR is opened or updated

**Process:**
1. Workflow checks out your code
2. Gets the diff between base and PR branches
3. Sends code changes to Claude API
4. Claude analyzes for:
   - Bugs and issues
   - Performance concerns
   - Best practice violations
   - Positive observations
   - Improvement suggestions
5. Posts review as PR comment

**File Types Reviewed:**
- Python (`.py`)
- Vue components (`.vue`)
- JavaScript/TypeScript (`.js`, `.ts`)
- Configuration (`.json`)

**Files Ignored:**
- Markdown (`.md`)
- Docs folder
- `.gitignore`

## Configuration Options

### Adjust Token Limit

In `.github/workflows/claude-code-review.yml`, modify:
```yaml
max_tokens: 1024  # Change this value
```

Higher = longer reviews, higher API cost

### Change Model

To use a different Claude model:
```yaml
model: 'claude-3-5-sonnet-20241022'  # Change this
```

Available models:
- `claude-3-opus-20250219` (most capable, higher cost)
- `claude-3-5-sonnet-20241022` (balanced)
- `claude-3-haiku-20250307` (fastest, lowest cost)

### Add More File Types

Edit the `paths-ignore` section:
```yaml
files: |
  **/*.py
  **/*.vue
  **/*.js
  **/*.ts
  **/*.java  # Add new extensions
```

## Troubleshooting

### "No ANTHROPIC_API_KEY found"
- Verify the secret is added to your repository
- Check the secret name is exactly: `ANTHROPIC_API_KEY`
- Ensure the API key is valid (not expired)

### "Claude Code Review failed to run"
- Check workflow logs: **Actions** → **Claude Code Review** → Failed run
- Common issues:
  - API key invalid or expired
  - GitHub API rate limited
  - diff too large (>50KB gets truncated)

### Reviews not posting
- Check if PR has actual code changes (docs/markdown only won't trigger)
- Verify GitHub Actions permissions include `pull-requests: write`

## Cost Considerations

**API Pricing:**
- Claude 3.5 Sonnet: ~$3 per million input tokens
- Average review: 50-200 output tokens per PR
- Estimated cost: **~$0.01 per PR review**

**Tips to reduce costs:**
- Use `claude-3-haiku` for simpler reviews
- Reduce `max_tokens` value
- Set `paths-ignore` to exclude unnecessary files

## Manual Review Request

If you want to request a manual Claude review at any time:

1. Create a comment on the PR with: `@claude review`
2. If the GitHub app is installed, Claude will respond

Otherwise, use VS Code Chat to review code manually.

## Next Steps

- Customize the review prompt in the workflow file
- Monitor workflow runs and review quality
- Adjust model/tokens based on your needs
- Share feedback to improve reviews

## Related Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Anthropic API Reference](https://docs.anthropic.com)
- [Main Project CLAUDE.md](../CLAUDE.md)
