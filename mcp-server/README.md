# PR Reviewer MCP Server

This MCP (Model Context Protocol) server allows coding agents like Claude Code, Cline, Continue.dev, and Cursor to receive and manage PR review comments.

## Available Tools

### `check_pr_comments`

Check for pending PR review comments in the current repository.

**Input:**

- `repo_path` (optional): Repository path. Auto-detected from agent's current working directory if not provided.

**Output:**
Returns formatted list of pending comments with file paths, line numbers, and content.

**Example:**

```
Found 2 PR review comments for my-app (feature-branch):

1. [src/utils.ts:42]
Consider using async/await here for better readability
   (id: abc123)

2. [src/app.ts:15-20]
This function should handle errors properly
   (id: def456)
```

### `mark_comment_resolved`

Mark a PR review comment as resolved after addressing it.

**Input:**

- `comment_id` (required): The comment ID from `check_pr_comments`

**Output:**
Confirmation message.

### `list_pending_comments`

List pending PR review comments across all registered repositories.

**Input:** None

**Output:**
Summary of pending comments per repository.

**Example:**

```
Pending PR comments across repositories:

● my-app (3 comments)
  /Users/dev/code/my-app
○ backend-api (0 comments)
  /Users/dev/code/backend-api

Total: 3 pending comments
```

### `get_comment_details`

Get detailed information about a specific PR review comment.

**Input:**

- `comment_id` (required): The comment ID

**Output:**
JSON with full comment details including timestamps and status.

## Configuration

### Claude Code

Add to `~/.config/claude/config.json`:

```json
{
	"mcpServers": {
		"pr-reviewer": {
			"command": "node",
			"args": ["/path/to/local-pr-reviewer/dist/mcp-server/index.js"]
		}
	}
}
```

### Cline (VS Code)

Add to `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`:

```json
{
	"mcpServers": {
		"pr-reviewer": {
			"command": "node",
			"args": ["/path/to/local-pr-reviewer/dist/mcp-server/index.js"]
		}
	}
}
```

### Continue.dev

Add to `~/.continue/config.json`:

```json
{
	"mcpServers": {
		"pr-reviewer": {
			"command": "node",
			"args": ["/path/to/local-pr-reviewer/dist/mcp-server/index.js"]
		}
	}
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
	"mcpServers": {
		"pr-reviewer": {
			"command": "node",
			"args": ["/path/to/local-pr-reviewer/dist/mcp-server/index.js"]
		}
	}
}
```

## Auto Setup

Run the setup script to automatically configure all detected agents:

```bash
pnpm setup:mcp
```

## Development

### Building

```bash
pnpm build:mcp
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/mcp-server/index.js
```

## Workflow

1. Open PR Reviewer UI in browser
2. Select repository and view diff
3. Add comments on specific lines
4. Click "Send Comments" to make them available
5. In your coding agent, ask: "Check for PR comments"
6. Agent receives comments and can address them
7. Agent marks comments as resolved when done

## Troubleshooting

### "No repository registered at path"

The repository needs to be registered in PR Reviewer first. Open the UI and select the repository.

### Comments not appearing

1. Make sure comments are marked as "sent" in the UI
2. Verify the agent's working directory matches the repository path
3. Check MCP connection in the UI (should show agent as connected)

### Agent not connected

1. Restart the coding agent after configuring MCP
2. Verify the MCP server path is correct in the config
3. Run `pnpm build:mcp` if the server hasn't been built

### Multiple agents

Multiple agents can connect simultaneously. Each agent tracks its own comment deliveries, so the same comment can be delivered to multiple agents.
