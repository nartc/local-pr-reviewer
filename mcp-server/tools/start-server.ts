// Tool: start_review_server
// Starts the review web server and returns the URL for the current repository

import { Effect } from 'effect';
import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpConfig } from '../shared/config.js';

interface ServerInfo {
	port: number;
	pid: number;
	startedAt: string;
}

interface StartServerArgs {
	repo_path?: string;
}

/**
 * Get the config directory path
 */
function getConfigDir(): string {
	const xdgConfig = process.env.XDG_CONFIG_HOME;
	const configBase = xdgConfig || join(homedir(), '.config');
	return join(configBase, 'local-pr-reviewer');
}

/**
 * Get path to server.json
 */
function getServerJsonPath(): string {
	return join(getConfigDir(), 'server.json');
}

/**
 * Get path to server.js
 */
function getServerJsPath(): string {
	return join(getConfigDir(), 'server.js');
}

/**
 * Get path to server.log
 */
function getServerLogPath(): string {
	return join(getConfigDir(), 'server.log');
}

/**
 * Read server info from server.json
 */
function readServerInfo(): ServerInfo | null {
	const serverJsonPath = getServerJsonPath();
	if (!existsSync(serverJsonPath)) {
		return null;
	}
	try {
		const content = readFileSync(serverJsonPath, 'utf-8');
		return JSON.parse(content) as ServerInfo;
	} catch {
		return null;
	}
}

/**
 * Write server info to server.json
 */
function writeServerInfo(info: ServerInfo): void {
	const serverJsonPath = getServerJsonPath();
	writeFileSync(serverJsonPath, JSON.stringify(info, null, 2));
}

/**
 * Check if a process with given PID is running
 */
function isProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Find an available port
 */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(startPort, '127.0.0.1', () => {
			const address = server.address();
			if (address && typeof address === 'object') {
				const port = address.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error('Could not get port')));
			}
		});
		server.on('error', () => {
			resolve(findAvailablePort(startPort + 1));
		});
	});
}

/**
 * Get the running server or start a new one
 */
async function getOrStartServer(): Promise<ServerInfo> {
	const existing = readServerInfo();

	// Check if existing server is still running
	if (existing && isProcessRunning(existing.pid)) {
		return existing;
	}

	// Need to start a new server
	const serverJsPath = getServerJsPath();
	const configDir = getConfigDir();

	if (!existsSync(serverJsPath)) {
		throw new Error(
			`Server not found at ${serverJsPath}. Run 'npx local-pr-reviewer setup' first.`,
		);
	}

	const port = await findAvailablePort();

	// Open log file for stdout/stderr
	const logPath = getServerLogPath();
	const logFd = openSync(logPath, 'a');

	const child = spawn('node', [serverJsPath], {
		cwd: configDir,
		env: {
			...process.env,
			PORT: String(port),
			NODE_ENV: 'production',
		},
		detached: true,
		stdio: ['ignore', logFd, logFd],
	});

	child.unref();

	const info: ServerInfo = {
		port,
		pid: child.pid!,
		startedAt: new Date().toISOString(),
	};

	writeServerInfo(info);

	// Give the server a moment to start
	await new Promise((resolve) => setTimeout(resolve, 1000));

	return info;
}

/**
 * Build the URL for the review page
 */
function buildUrl(port: number, repoPath?: string): string {
	const baseUrl = `http://localhost:${port}`;
	if (repoPath) {
		return `${baseUrl}/review?repo=${encodeURIComponent(repoPath)}`;
	}
	return baseUrl;
}

export const startServer = (
	args: StartServerArgs,
): Effect.Effect<string, Error, McpConfig> =>
	Effect.gen(function* () {
		const config = yield* McpConfig;
		const repoPath = args.repo_path || config.workingDir;

		yield* Effect.logInfo('Starting review server').pipe(
			Effect.annotateLogs({ repoPath }),
		);

		const serverInfo = yield* Effect.tryPromise({
			try: () => getOrStartServer(),
			catch: (error) =>
				new Error(
					error instanceof Error
						? error.message
						: 'Failed to start server',
				),
		});

		const url = buildUrl(serverInfo.port, repoPath);

		const wasRunning = readServerInfo()?.startedAt === serverInfo.startedAt;

		if (wasRunning) {
			return `Review server already running.\n\nOpen: ${url}`;
		}

		return `Review server started on port ${serverInfo.port}.\n\nOpen: ${url}`;
	}).pipe(Effect.withSpan('tool.startServer'));
