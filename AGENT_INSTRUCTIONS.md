# Local PR Reviewer - Agent Instructions

This document provides setup and usage instructions for AI coding agents.

## Overview

Local PR Reviewer enables code review workflows via a local webapp + MCP integration. Agents can automatically detect pending review comments and address them.

## Quick Check

- Config: `~/.config/local-pr-reviewer/config.json`
- If missing: not set up, offer to set up
- If exists: verify setup, check signals on review-related keywords

## First-Time Setup Flow

Gather all information first, then execute:

### Questions Phase

1. Ask: "Where should I clone local-pr-reviewer? (e.g., ~/tools)"
2. Ask: "Clone via HTTPS or SSH?"
    - HTTPS: `https://github.com/nartc/local-pr-reviewer.git`
    - SSH: `git@github.com:nartc/local-pr-reviewer.git`
3. Ask: "Which coding agents do you use?" (Claude Code, OpenCode, etc.)
4. Ask: "Set up AI for smart comment processing? (y/n)"
    - If yes: "Which provider? (google/openai/anthropic)"
    - If yes: "API key for {provider}?"
5. Ask: "Paths to scan for git repos? (comma-separated, default: ~/code)"

### Execution Phase

6. Clone repo to `{install-path}/local-pr-reviewer`
7. Write `.env` file with collected config
8. Run: `pnpm install`
9. Run: `pnpm build`
10. Configure MCP for selected agents (see MCP Config section)
11. Register skills for selected agents (see Skill Registration section)
12. Write `~/.config/local-pr-reviewer/config.json`
13. Start webapp in background

### Error Handling

#### pnpm install failure

Show error output, then suggest:

1. "Check Node.js version (requires Node 18+)"
2. "Try clearing pnpm cache: `pnpm store prune`"
3. "Check network connectivity"

Ask: "Want me to retry pnpm install?"

#### pnpm build failure

Show error output, then suggest:

1. "Check for TypeScript errors in the output"
2. "Try removing node_modules and reinstalling: `rm -rf node_modules && pnpm install`"
3. "Check if all dependencies are installed"

Ask: "Want me to retry the build?"

#### Webapp start failure

Show error output, then suggest:

1. "Check if another process is using the port"
2. "Check webapp.log for details: `~/.config/local-pr-reviewer/webapp.log`"
3. "Try rebuilding: `pnpm build`"

Ask: "Want me to retry starting the webapp?"

## Subsequent Setup (Idempotent)

1. Check `config.json` exists? If no, run first-time setup
2. Check `installPath` exists? If no, re-clone
3. Check `node_modules` exists? If no, run `pnpm install`
4. Check build output exists? If no, run `pnpm build`
5. Health check `GET http://localhost:{port}/api/health` (read port from `runtime.json`)
    - If fail (3 retries): start webapp
6. Ready

## Runtime Behavior

### Proactive Checking (IMPORTANT)

**You MUST check for pending reviews automatically:**

1. **At conversation start** - Call `check_for_pending_reviews` as one of your first actions
2. **After completing any task** - Before asking "what's next?" or going idle, call `check_for_pending_reviews`
3. **When user returns after being away** - Check again

If pending reviews found:

- Say: "You have {count} pending review comments for {repoName}. Want me to address them?"
- Wait for user confirmation before proceeding

### Trigger Keywords

When user mentions: review, PR, pull request, comment, feedback, suggestion, address, fix

### Action

1. Call `check_for_pending_reviews` MCP tool
2. If `hasPending: true`:
    - Say: "You have {count} pending review comments for {repoName}. Want me to address them?"
3. If user confirms:
    - Call `check_pr_comments` for that repo
    - Address each comment
    - Call `mark_comment_resolved` after addressing

## Starting the Webapp

### Check if Running

Read `~/.config/local-pr-reviewer/runtime.json`:

- If exists and PID is alive: webapp running at `http://localhost:{port}`
- If not: start webapp

### Start Command (Platform-Specific)

**macOS/Linux:**

```bash
cd {installPath}
nohup pnpm start > ~/.config/local-pr-reviewer/webapp.log 2>&1 &
```

**Windows:**

```cmd
cd {installPath}
start /b pnpm start > %USERPROFILE%\.config\local-pr-reviewer\webapp.log 2>&1
```

### Health Check

After starting, retry `GET /api/health` up to 3 times with 2-second delays.

## MCP Configuration

### Config Detection

Before modifying, detect existing config file:

**Claude Code:**

1. Check `~/.claude.json` exists? Use it
2. Else create `~/.claude.json`

**OpenCode:**

1. Check `$XDG_CONFIG_HOME/opencode/.opencode.json` Use it
2. Else check `~/.opencode.json` exists? Use it
3. Else create `~/.opencode.json`

### MCP Server Entry

Add to the detected config file under `mcpServers`:

```json
{
	"mcpServers": {
		"local-pr-reviewer": {
			"command": "node",
			"args": [
				"{installPath}/local-pr-reviewer/dist/mcp-server/index.js"
			],
			"env": {}
		}
	}
}
```

## Skill Registration

### Claude Code

**Global instructions** - Append to `~/.claude/CLAUDE.md`:

```markdown
## Local PR Review

When user mentions: review, PR, pull request, comment, feedback

- Call `check_for_pending_reviews` MCP tool
- If pending: ask user before addressing

For setup: `/local-pr-review setup`
```

**Slash command** - Copy `{installPath}/local-pr-reviewer/skills/claude/local-pr-review.md` to `~/.claude/commands/local-pr-review.md`

### OpenCode

Create symlink:

```bash
ln -s {installPath}/local-pr-reviewer/skills/opencode ~/.config/opencode/skills/local-pr-review
```

## MCP Tools Reference

| Tool                         | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `check_for_pending_reviews`  | Lightweight signal scan - returns pending reviews across all repos |
| `check_pr_comments`          | Get full comment details for current repo, marks as delivered      |
| `mark_comment_resolved`      | Mark a comment as resolved after addressing                        |
| `list_pending_comments`      | List pending comments across all repos (legacy)                    |
| `list_repo_pending_comments` | List pending for current repo only (legacy)                        |
| `get_comment_details`        | Get details of a specific comment by ID                            |

## .env File Template

```env
# AI Provider (optional - skip for manual-only comments)
AI_PROVIDER=google
GOOGLE_API_KEY=your-key-here
# OR
# AI_PROVIDER=openai
# OPENAI_API_KEY=your-key-here
# OR
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=your-key-here

# Repository scanning
REPO_SCAN_ROOT=/Users/you/code,/Users/you/projects
REPO_SCAN_MAX_DEPTH=3
```

## config.json Format

Location: `~/.config/local-pr-reviewer/config.json`

```json
{
	"installPath": "/path/to/local-pr-reviewer",
	"installedAt": "2026-01-23T10:00:00Z"
}
```

## runtime.json Format

Location: `~/.config/local-pr-reviewer/runtime.json`

```json
{
	"port": 3456,
	"pid": 12345,
	"startedAt": "2026-01-23T14:00:00Z"
}
```
