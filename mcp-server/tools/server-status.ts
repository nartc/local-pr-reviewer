// Tool: get_server_status
// Returns the status of the review web server

import { Effect } from 'effect';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpConfig } from '../shared/config.js';

interface ServerInfo {
	port: number;
	pid: number;
	startedAt: string;
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
 * Delete stale server.json
 */
function deleteServerInfo(): void {
	const serverJsonPath = getServerJsonPath();
	if (existsSync(serverJsonPath)) {
		unlinkSync(serverJsonPath);
	}
}

export const getServerStatus = (): Effect.Effect<string, never, McpConfig> =>
	Effect.gen(function* () {
		const config = yield* McpConfig;
		const serverInfo = readServerInfo();

		if (!serverInfo) {
			return 'Review server is not running.\n\nUse the `start_review_server` tool to start it.';
		}

		// Check if process is actually running
		if (!isProcessRunning(serverInfo.pid)) {
			// Clean up stale server.json
			deleteServerInfo();
			return 'Review server is not running (stale process detected).\n\nUse the `start_review_server` tool to start it.';
		}

		const baseUrl = `http://localhost:${serverInfo.port}`;
		const repoUrl = `${baseUrl}/review?repo=${encodeURIComponent(config.workingDir)}`;
		const uptime = getUptime(serverInfo.startedAt);

		return [
			'Review server is running.',
			'',
			`  Port: ${serverInfo.port}`,
			`  PID: ${serverInfo.pid}`,
			`  Uptime: ${uptime}`,
			'',
			`Home: ${baseUrl}`,
			`Current repo: ${repoUrl}`,
		].join('\n');
	}).pipe(Effect.withSpan('tool.getServerStatus'));

/**
 * Calculate human-readable uptime
 */
function getUptime(startedAt: string): string {
	const start = new Date(startedAt).getTime();
	const now = Date.now();
	const diff = now - start;

	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days}d ${hours % 24}h`;
	}
	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${seconds}s`;
}
