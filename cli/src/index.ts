#!/usr/bin/env node
// CLI entry point for local-pr-reviewer

import { setupMcp } from './commands/setup-mcp.js';
import { setup } from './commands/setup.js';
import { start } from './commands/start.js';
import { stop } from './commands/stop.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp(): void {
	console.log(`
local-pr-reviewer - CLI for setting up and managing local-pr-reviewer

Usage:
  npx local-pr-reviewer <command> [options]

Commands:
  setup       Install and configure local-pr-reviewer
  start       Start the review server
  stop        Stop the review server
  setup-mcp   Configure MCP for coding agents

Options:
  --help      Show this help message
  --repo      (start) Repository path for the review URL

Examples:
  npx local-pr-reviewer setup
  npx local-pr-reviewer start
  npx local-pr-reviewer start --repo=/path/to/repo
  npx local-pr-reviewer stop
  npx local-pr-reviewer setup-mcp
`);
}

function parseArgs(args: string[]): Record<string, string | boolean> {
	const result: Record<string, string | boolean> = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const nextArg = args[i + 1];

			// Check if next arg is a value (not another flag)
			if (nextArg && !nextArg.startsWith('--')) {
				result[key] = nextArg;
				i++; // Skip the next arg
			} else if (arg.includes('=')) {
				const [k, v] = arg.slice(2).split('=');
				result[k] = v;
			} else {
				result[key] = true;
			}
		}
	}

	return result;
}

async function main(): Promise<void> {
	const parsedArgs = parseArgs(args);

	if (parsedArgs.help || command === 'help' || !command) {
		printHelp();
		process.exit(0);
	}

	switch (command) {
		case 'setup':
			await setup({ force: parsedArgs.force === true });
			break;

		case 'start':
			await start({
				repo:
					typeof parsedArgs.repo === 'string'
						? parsedArgs.repo
						: undefined,
			});
			break;

		case 'stop':
			await stop();
			break;

		case 'setup-mcp':
			await setupMcp();
			break;

		default:
			console.error(`Unknown command: ${command}`);
			printHelp();
			process.exit(1);
	}
}

main().catch((error) => {
	console.error('Error:', error.message);
	process.exit(1);
});
