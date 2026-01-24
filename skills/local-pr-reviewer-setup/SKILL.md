---
name: local-pr-reviewer-setup
description: Setup and usage guide for local-pr-reviewer - a local PR review tool for AI coding agents. Enables users to review code changes via a web UI and send comments back to their AI coding session.
---

# Local PR Reviewer

A local PR review tool that lets you review code changes in a web UI and send feedback to your AI coding session.

## First-time Setup

If the user hasn't set up local-pr-reviewer yet, guide them to run:

```bash
npx local-pr-reviewer setup
```

This will:

- Install the review server to `~/.config/local-pr-reviewer/`
- Configure MCP tools for your coding agent
- Optionally setup AI features for comment processing

## Starting a Review Session

To start reviewing code, use the `start_review_server` MCP tool. This will:

1. Start the web server if not already running
2. Return a URL to the review interface for the current repository

Alternatively, the user can run:

```bash
npx local-pr-reviewer start
```

## Workflow

1. **Start Review Server**: Use `start_review_server` tool to get the review URL
2. **Open Review UI**: Navigate to the URL in a browser
3. **Write Comments**: Review the diff, add comments to specific lines or files
4. **Send Comments**: Click "Send" to queue comments for the coding agent
5. **Receive Comments**: Use `check_pr_comments` tool to fetch pending comments
6. **Address Comments**: Make the requested changes
7. **Mark Resolved**: Use `mark_comment_resolved` tool after addressing each comment

## Available MCP Tools

### `start_review_server`

Starts the review web server and returns the URL for the current repository.

**When to use**: When user wants to review code or start a review session.

### `get_server_status`

Check if the review server is running and get its URL.

**When to use**: To check server status without starting it.

### `check_pr_comments`

Fetch pending review comments for the current repository. Comments are marked as delivered after fetching.

**When to use**: After user has written comments in the web UI, or when user asks to check for comments.

### `check_for_pending_reviews`

Lightweight check using signal files to see if there are pending comments. Faster than `check_pr_comments`.

**When to use**: For quick periodic checks to see if any comments are waiting.

### `mark_comment_resolved`

Mark a comment as resolved after addressing it. Use the comment ID from `check_pr_comments`.

**When to use**: After you've addressed a review comment.

### `list_pending_comments`

List pending comments across all repositories.

**When to use**: To see all pending review work.

### `list_repo_pending_comments`

List pending comments for the current repository only.

**When to use**: To see pending comments for the current project.

### `get_comment_details`

Get full details of a specific comment including file path, line numbers, and content.

**When to use**: When you need more context about a specific comment.

## Signal File

The tool uses a signal file (`.local-pr-reviewer-pending`) in the repository root to indicate when new comments are available. This file is automatically managed and should be added to `.gitignore`.

## Stopping the Server

To stop the running server:

```bash
npx local-pr-reviewer stop
```

## Updating

To update to the latest version:

```bash
npx local-pr-reviewer@latest setup
```

## Troubleshooting

### Server not starting

- Run `npx local-pr-reviewer setup` to ensure proper installation
- Check if another process is using the port

### Comments not appearing

- Ensure you're in the correct repository
- Check that the repository is registered in the review UI
- Use `check_pr_comments` to manually fetch comments

### MCP tools not available

- Run `npx local-pr-reviewer setup-mcp` to reconfigure MCP
- Restart your coding agent after configuration changes
