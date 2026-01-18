# tmux-pr-reviewer

A local PR review tool that lets you review git diffs, add comments, process them with AI, and send feedback directly to your tmux sessions (e.g., Claude Code, Cursor, etc.).

## Demo

[![tmux-pr-reviewer demo](https://img.youtube.com/vi/-ZbH5ddwm5U/maxresdefault.jpg)](https://www.youtube.com/watch?v=-ZbH5ddwm5U)

## Why?

When reviewing PRs or working with AI coding assistants in tmux, you often want to:

- See the full diff in a proper UI
- Add comments on specific lines
- Process multiple comments with AI to consolidate/improve them
- Send feedback directly to your AI assistant's tmux session

This tool does exactly that - locally, with no external services required (except optional AI providers).

## Requirements

- **Node.js** 20+
- **pnpm** (recommended) or npm
- **tmux** - Required for sending comments to sessions

## Installation

```bash
git clone https://github.com/nartc/tmux-pr-reviewer.git
cd tmux-pr-reviewer
pnpm install
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# AI Provider API Keys (at least one required for AI features)
GOOGLE_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here

# Repository scanning settings
REPO_SCAN_ROOT=~/code        # Root directory to scan for git repos
REPO_SCAN_MAX_DEPTH=3        # How deep to scan for repos
```

## Usage

Start the development server:

```bash
pnpm dev
```

Open http://localhost:5173

### Workflow

1. **Select a repository** from the scanned list
2. **View the diff** against the base branch
3. **Add comments** on specific lines or files
4. **Stage comments** you want to send
5. **Process with AI** (optional) to consolidate and improve comments
6. **Select a tmux session** (e.g., your Claude Code session)
7. **Send** comments directly to the session

## Tech Stack

- [React Router 7](https://reactrouter.com/) - Full-stack React framework
- [Effect](https://effect.website/) - Typed functional programming
- [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/) - UI components
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Local database
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI provider integrations

## License

MIT
