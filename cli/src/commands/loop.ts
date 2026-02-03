// Main review loop command for local-pr-reviewer v2

import * as p from '@clack/prompts';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import color from 'picocolors';
import { getAgentForProject, isGitRepo } from '../utils/migration.js';
import {
	getRunningServer,
	getServerUrl,
	startServer,
} from '../utils/process.js';

interface LoopOptions {
	agent?: string;
}

interface SignalFile {
	sessionId: string;
	repoPath: string;
	pendingCount: number;
	updatedAt: string;
}

export async function loop(options: LoopOptions = {}): Promise<void> {
	const cwd = process.cwd();

	// Validate git repo
	if (!isGitRepo(cwd)) {
		console.error(
			color.red('Error: Current directory is not a git repository.'),
		);
		console.log('Run this command from the root of a git repository.');
		process.exit(1);
	}

	// Determine agent
	const agent = options.agent ?? getAgentForProject(cwd);

	if (!['claude', 'opencode'].includes(agent)) {
		console.error(
			color.red(
				`Error: Unknown agent "${agent}". Use 'claude' or 'opencode'.`,
			),
		);
		process.exit(1);
	}

	// Ensure server is running
	let serverInfo = getRunningServer();
	if (!serverInfo) {
		try {
			serverInfo = await startServer();
		} catch (error) {
			console.error(color.red('Error: Could not start review server.'));
			console.log('Try running `npx local-pr-reviewer setup` first.');
			process.exit(1);
		}
	}

	const repoName = basename(cwd);
	const webUrl = `${getServerUrl(serverInfo)}/review/${encodeURIComponent(repoName)}`;

	// Show intro and confirm
	p.intro(color.bgCyan(color.black(' local-pr-reviewer ')));

	console.log();
	console.log(
		`  ${color.yellow('⚠')}  This will spawn coding agents with elevated`,
	);
	console.log(`     permissions (no approval prompts).`);
	console.log();
	console.log(`  Agent: ${color.cyan(agent)}`);
	console.log(`  Repo:  ${color.dim(cwd)}`);
	console.log(`  Web:   ${color.cyan(webUrl)}`);
	console.log();

	const confirmed = await p.confirm({
		message: 'Continue?',
		initialValue: true,
	});

	if (p.isCancel(confirmed) || !confirmed) {
		p.cancel('Cancelled.');
		process.exit(0);
	}

	// Setup graceful exit
	process.on('SIGINT', () => {
		console.log('\n\nExiting loop. Server continues running.');
		console.log(
			`Run ${color.cyan('npx local-pr-reviewer stop')} to stop the server.`,
		);
		process.exit(0);
	});

	// Enter watch loop
	console.log();
	console.log(
		color.green('Watching for PR comments...') +
			color.dim(' (Ctrl+C to exit)'),
	);
	console.log(`Open ${color.cyan(webUrl)} to review and add comments.\n`);

	const signalPath = join(cwd, '.local-pr-reviewer-pending');

	while (true) {
		if (existsSync(signalPath)) {
			try {
				const signal: SignalFile = JSON.parse(
					readFileSync(signalPath, 'utf-8'),
				);

				if (signal.pendingCount > 0) {
					console.log();
					const proceed = await p.confirm({
						message: `${signal.pendingCount} comment(s) ready. Start ${agent} session?`,
						initialValue: true,
					});

					if (!p.isCancel(proceed) && proceed) {
						await spawnAgent(agent, cwd);
						console.log();
						console.log(
							color.green('Session ended. Resuming watch...'),
						);
						console.log();
					}

					// Delete signal file (fresh start for next batch)
					try {
						unlinkSync(signalPath);
					} catch {
						// Ignore
					}
				}
			} catch {
				// Invalid signal file, remove it
				try {
					unlinkSync(signalPath);
				} catch {
					// Ignore
				}
			}
		}

		// Poll interval
		await sleep(2000);
	}
}

async function spawnAgent(agent: string, cwd: string): Promise<void> {
	const prompt = `You have PR review comments to address.

Use the check_pr_comments MCP tool to fetch pending comments for this repository.
Address each comment by making the necessary code changes.
After addressing a comment, use mark_comment_resolved to mark it done.
When all comments are resolved, exit the session.`;

	console.log();
	console.log(color.dim(`Spawning ${agent}...`));
	console.log();

	if (agent === 'claude') {
		spawnSync('claude', ['--dangerously-skip-permissions', prompt], {
			cwd,
			stdio: 'inherit',
		});
	} else if (agent === 'opencode') {
		const configPath = join(cwd, 'opencode.json');
		const hadExisting = existsSync(configPath);
		let existingConfig: string | null = null;

		if (hadExisting) {
			existingConfig = readFileSync(configPath, 'utf-8');
		}

		// Write permissive config
		writeFileSync(
			configPath,
			JSON.stringify(
				{
					$schema: 'https://opencode.ai/config.json',
					permission: 'allow',
				},
				null,
				2,
			),
		);

		try {
			spawnSync('opencode', ['--prompt', prompt], {
				cwd,
				stdio: 'inherit',
			});
		} finally {
			// Restore or delete config
			if (hadExisting && existingConfig) {
				writeFileSync(configPath, existingConfig);
			} else {
				try {
					unlinkSync(configPath);
				} catch {
					// Ignore
				}
			}
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
