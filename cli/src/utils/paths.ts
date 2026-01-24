// Platform-aware paths for local-pr-reviewer

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Get the global config directory for local-pr-reviewer
 * Uses ~/.config/local-pr-reviewer on all platforms
 */
export function getConfigDir(): string {
	// Use XDG_CONFIG_HOME if set, otherwise ~/.config
	const xdgConfig = process.env.XDG_CONFIG_HOME;
	const configBase = xdgConfig || join(homedir(), '.config');
	return join(configBase, 'local-pr-reviewer');
}

/**
 * Get path to server.json (running instance info)
 */
export function getServerJsonPath(): string {
	return join(getConfigDir(), 'server.json');
}

/**
 * Get path to version.json (installed version info)
 */
export function getVersionJsonPath(): string {
	return join(getConfigDir(), 'version.json');
}

/**
 * Get path to preferences.json
 */
export function getPreferencesPath(): string {
	return join(getConfigDir(), 'preferences.json');
}

/**
 * Get path to .env file
 */
export function getEnvPath(): string {
	return join(getConfigDir(), '.env');
}

/**
 * Get path to database
 */
export function getDbPath(): string {
	return join(getConfigDir(), 'db', 'pr-reviewer.db');
}

/**
 * Get path to MCP server entry point
 */
export function getMcpServerPath(): string {
	return join(getConfigDir(), 'dist', 'mcp-server', 'index.js');
}

/**
 * Get path to web server entry point
 */
export function getServerJsPath(): string {
	return join(getConfigDir(), 'server.js');
}

/**
 * Get path to build directory
 */
export function getBuildDir(): string {
	return join(getConfigDir(), 'build');
}

/**
 * Get path to dist directory
 */
export function getDistDir(): string {
	return join(getConfigDir(), 'dist');
}

/**
 * Claude Code settings path
 */
export function getClaudeCodeSettingsPath(): string {
	return join(homedir(), '.claude', 'settings.json');
}

/**
 * OpenCode config path
 */
export function getOpenCodeConfigPath(): string {
	const xdgConfig = process.env.XDG_CONFIG_HOME;
	const configBase = xdgConfig || join(homedir(), '.config');
	return join(configBase, 'opencode', 'opencode.json');
}
