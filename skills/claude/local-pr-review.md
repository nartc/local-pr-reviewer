# /local-pr-review

Local PR review workflow management.

## Usage

- `/local-pr-review setup` - First-time setup or verify installation
- `/local-pr-review start` - Start webapp if not running
- `/local-pr-review check` - Check for pending reviews
- `/local-pr-review status` - Show current state (webapp running, port, pending counts)
- `/local-pr-review open` - Open webapp in browser

## Setup Flow

### Quick Check

- Config: `~/.config/local-pr-reviewer/config.json`
- If missing: run full setup
- If exists: verify and start if needed

### First-Time Setup

1. Ask: "Where should I clone local-pr-reviewer? (e.g., ~/tools)"
2. Ask: "Clone via HTTPS or SSH?"
3. Ask: "Which coding agents do you use?" (Claude Code, OpenCode)
4. Ask: "Set up AI for smart comment processing? (y/n)"
5. Ask: "Paths to scan for git repos?"

Then execute:

1. Clone to `{path}/local-pr-reviewer`
2. Write `.env`
3. Run `pnpm install && pnpm build`
4. Configure MCP for selected agents
5. Register skills/commands
6. Write config.json
7. Start webapp

### Error Handling

If `pnpm install` fails:

- Check Node.js version (requires 18+)
- Try `pnpm store prune`
- Check network

If `pnpm build` fails:

- Check TypeScript errors
- Try removing node_modules and reinstall

### MCP Configuration

Add to Claude config (`~/.claude.json`):

```json
{
	"mcpServers": {
		"local-pr-reviewer": {
			"command": "node",
			"args": ["{installPath}/local-pr-reviewer/dist/mcp-server/index.js"]
		}
	}
}
```

## Runtime Behavior

When user mentions: review, PR, pull request, comment, feedback

1. Call `check_for_pending_reviews` MCP tool
2. If pending: ask user before addressing
3. If confirmed: fetch and address each comment

### If MCP Tools Not Available

If you don't see `check_for_pending_reviews` or other `local-pr-reviewer` tools:

1. **Check if MCP is configured**: Read `~/.claude.json` and look for `local-pr-reviewer` or `pr-reviewer` in `mcpServers`
2. **If not configured**: The user needs to run `/local-pr-review setup` first
3. **If configured but not working**:
    - Verify the path exists: `ls {installPath}/dist/mcp-server/index.js`
    - Rebuild if needed: `pnpm build:mcp` in the install directory
    - Claude Code needs restart after MCP config changes

**Alternative without MCP**: Check signal files directly:

```bash
ls ~/.config/local-pr-reviewer/signals/
```

If signal files exist, the webapp has pending comments. Direct user to the webapp UI.

## Starting Webapp

Check `~/.config/local-pr-reviewer/runtime.json`:

- If exists and PID alive: already running
- If not: start with `nohup pnpm start &`

Health check: `GET http://localhost:{port}/api/health`
