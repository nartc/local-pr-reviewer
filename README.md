# PR Reviewer

A local PR review tool that lets you review git diffs, add comments, and send feedback to AI coding agents via MCP (Model Context Protocol).

## Demo

[![PR Reviewer demo](https://img.youtube.com/vi/-ZbH5ddwm5U/maxresdefault.jpg)](https://www.youtube.com/watch?v=-ZbH5ddwm5U)

## Why?

When reviewing PRs or working with AI coding assistants, you often want to:

- See the full diff in a proper UI (not inline in your editor)
- Add comments on specific lines or general feedback
- Process multiple comments with AI to consolidate/improve them
- Have your AI assistant automatically receive and act on your feedback

This tool does exactly that - locally, with no external services required (except optional AI providers for comment processing).

## Requirements

- **Node.js** 20+
- **pnpm** (recommended) or npm

## Installation

```bash
git clone https://github.com/nartc/local-pr-reviewer.git
cd local-pr-reviewer
pnpm install
pnpm build
```

## MCP Server Setup (Recommended)

The MCP server allows AI coding agents to directly receive your review comments. This is the recommended approach for Claude Code, Cursor, and other MCP-compatible agents.

### Manual Setup

Add the following to your agent's MCP configuration:

**Claude Code CLI** (`~/.claude/settings.json` on macOS, `~/.config/claude/config.json` on Linux):

```json
{
	"mcpServers": {
		"pr-reviewer": {
			"type": "local",
			"command": [
				"node",
				"/absolute/path/to/local-pr-reviewer/dist/mcp-server/index.js"
			]
		}
	}
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
	"mcpServers": {
		"pr-reviewer": {
			"command": "node",
			"args": [
				"/absolute/path/to/local-pr-reviewer/dist/mcp-server/index.js"
			]
		}
	}
}
```

**Cursor** (`~/.cursor/mcp.json`):

```json
{
	"mcpServers": {
		"pr-reviewer": {
			"command": "node",
			"args": [
				"/absolute/path/to/local-pr-reviewer/dist/mcp-server/index.js"
			]
		}
	}
}
```

After adding the configuration, **restart your coding agent** for changes to take effect.

### Auto Setup (Alternative)

If you prefer automatic configuration, run:

```bash
pnpm setup:mcp
```

This will detect installed agents and configure them automatically. You'll still need to restart your agent afterward.

### Available MCP Tools

Once configured, your agent will have access to:

| Tool                         | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `check_pr_comments`          | Check for pending review comments in the current repo |
| `mark_comment_resolved`      | Mark a comment as resolved after addressing it        |
| `list_pending_comments`      | List pending comments across all repos                |
| `list_repo_pending_comments` | List pending comments for current repo only           |
| `get_comment_details`        | Get full details of a specific comment                |

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# AI Provider API Keys (at least one required for AI processing features)
GOOGLE_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here

# Repository scanning settings
REPO_SCAN_ROOT=/Users/me/code              # Directories to scan for git repos
REPO_SCAN_MAX_DEPTH=3                      # How deep to scan for repos
```

### Repository Scanning

`REPO_SCAN_ROOT` accepts a comma-separated list of **absolute paths** to scan for git repositories:

```bash
# Single directory
REPO_SCAN_ROOT=/Users/me/code

# Multiple directories
REPO_SCAN_ROOT=/Users/me/code,/Users/me/projects,/Users/me/work
```

If not set, defaults to your home directory (`$HOME`).

## Usage

Start the server:

```bash
pnpm start        # Production
# or
pnpm dev          # Development with hot reload
```

Open <http://localhost:3000>

### Workflow

1. **Select a repository** from the scanned list
2. **View the diff** against the base branch
3. **Add comments:**
    - Click on line numbers in the diff to add inline comments
    - Use the **+** button in the Comments panel for general feedback
4. **Queue or Send Now:**
    - **Queue** - Stage comments for batch sending
    - **Send Now** - Immediately send to your agent
5. **Process with AI** (optional) - Consolidate and improve staged comments
    - I don't think this is working 😅
6. **Send** - Deliver all staged comments to your agent

### How Agents Receive Comments

Your agent calls `check_pr_comments` to receive pending comments for the current repository. After addressing each comment, it should call `mark_comment_resolved` to mark it complete.

## Tech Stack

- [React Router 7](https://reactrouter.com/) - Full-stack React framework
- [Effect](https://effect.website/) - Typed functional programming
- [MCP SDK](https://modelcontextprotocol.io/) - Model Context Protocol server
- [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/) - UI components
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Local database
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI provider integrations

## License

MIT
