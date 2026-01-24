// Process management for local-pr-reviewer server

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { getConfigDir, getServerJsonPath, getServerJsPath } from './paths.js';

export interface ServerInfo {
	port: number;
	pid: number;
	startedAt: string;
}

/**
 * Read server info from server.json
 */
export function readServerInfo(): ServerInfo | null {
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
export function writeServerInfo(info: ServerInfo): void {
	const serverJsonPath = getServerJsonPath();
	writeFileSync(serverJsonPath, JSON.stringify(info, null, 2));
}

/**
 * Delete server.json
 */
export function deleteServerInfo(): void {
	const serverJsonPath = getServerJsonPath();
	if (existsSync(serverJsonPath)) {
		unlinkSync(serverJsonPath);
	}
}

/**
 * Check if a process with given PID is running
 */
export function isProcessRunning(pid: number): boolean {
	try {
		// Sending signal 0 checks if process exists without killing it
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Kill a process by PID
 */
export function killProcess(pid: number): boolean {
	try {
		process.kill(pid, 'SIGTERM');
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if server is running and return info if so
 */
export function getRunningServer(): ServerInfo | null {
	const info = readServerInfo();
	if (!info) {
		return null;
	}

	if (!isProcessRunning(info.pid)) {
		// Process is dead, clean up stale server.json
		deleteServerInfo();
		return null;
	}

	return info;
}

/**
 * Find an available port
 */
export async function findAvailablePort(
	startPort: number = 3000,
): Promise<number> {
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
			// Port is in use, try next one
			resolve(findAvailablePort(startPort + 1));
		});
	});
}

/**
 * Start the server as a background process
 */
export async function startServer(): Promise<ServerInfo> {
	const serverJsPath = getServerJsPath();
	const configDir = getConfigDir();

	if (!existsSync(serverJsPath)) {
		throw new Error(
			`Server not found at ${serverJsPath}. Run 'npx local-pr-reviewer setup' first.`,
		);
	}

	const port = await findAvailablePort();

	const child = spawn('node', [serverJsPath], {
		cwd: configDir,
		env: {
			...process.env,
			PORT: String(port),
			NODE_ENV: 'production',
		},
		detached: true,
		stdio: 'ignore',
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
 * Stop the running server
 */
export function stopServer(): boolean {
	const info = getRunningServer();
	if (!info) {
		return false;
	}

	const killed = killProcess(info.pid);
	if (killed) {
		deleteServerInfo();
	}

	return killed;
}

/**
 * Get the URL for the running server
 */
export function getServerUrl(info: ServerInfo, repoPath?: string): string {
	const baseUrl = `http://localhost:${info.port}`;
	if (repoPath) {
		return `${baseUrl}/review?repo=${encodeURIComponent(repoPath)}`;
	}
	return baseUrl;
}
