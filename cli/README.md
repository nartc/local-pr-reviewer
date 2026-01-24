# local-pr-reviewer

CLI for setting up and managing local-pr-reviewer - a local PR review tool for AI coding agents.

## Installation

```bash
npx local-pr-reviewer setup
```

## Commands

### `setup`

Install and configure local-pr-reviewer globally.

```bash
npx local-pr-reviewer setup
```

This will:

- Install the review server to `~/.config/local-pr-reviewer/`
- Configure MCP tools for Claude Code and/or OpenCode
- Optionally setup AI features
- Install the skill via Vercel Skills

### `start`

Start the review server.

```bash
npx local-pr-reviewer start
```

Returns the URL to the review interface. If already running, returns the existing URL.

### `stop`

Stop the running review server.

```bash
npx local-pr-reviewer stop
```

### `setup-mcp`

Configure MCP for additional coding agents.

```bash
npx local-pr-reviewer setup-mcp
```

## MCP Tools

After setup, these tools are available in your coding agent:

- `start_review_server` - Start the web server and get URL
- `get_server_status` - Check if server is running
- `check_pr_comments` - Fetch pending review comments
- `mark_comment_resolved` - Mark a comment as resolved
- `list_pending_comments` - List all pending comments
- `get_comment_details` - Get details of a specific comment

## Configuration

Configuration is stored in `~/.config/local-pr-reviewer/`:

- `server.json` - Running server info (port, PID)
- `version.json` - Installed version
- `preferences.json` - User preferences
- `.env` - AI provider configuration (optional)

## License

MIT
