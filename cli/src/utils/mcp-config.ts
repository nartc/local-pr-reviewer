// MCP configuration management for Claude Code and OpenCode

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
	getClaudeCodeSettingsPath,
	getMcpServerPath,
	getOpenCodeConfigPath,
} from './paths.js';

export type CodingAgent = 'claude-code' | 'opencode';

interface McpServerConfig {
	type: 'local';
	command: string[];
}

interface ClaudeCodeSettings {
	mcpServers?: Record<string, McpServerConfig>;
	[key: string]: unknown;
}

interface OpenCodeConfig {
	mcp?: Record<string, McpServerConfig>;
	[key: string]: unknown;
}

/**
 * Read JSON file with JSONC support (strips comments)
 */
function readJsonFile<T>(path: string): T | null {
	if (!existsSync(path)) {
		return null;
	}
	try {
		let content = readFileSync(path, 'utf-8');
		// Strip single-line comments
		content = content.replace(/\/\/.*$/gm, '');
		// Strip multi-line comments
		content = content.replace(/\/\*[\s\S]*?\*\//g, '');
		return JSON.parse(content) as T;
	} catch {
		return null;
	}
}

/**
 * Write JSON file
 */
function writeJsonFile(path: string, data: unknown): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Get the MCP server command array
 */
function getMcpCommand(): string[] {
	const mcpServerPath = getMcpServerPath();
	return ['node', mcpServerPath];
}

/**
 * Configure MCP for Claude Code
 */
export function configureClaudeCode(): { success: boolean; path: string } {
	const settingsPath = getClaudeCodeSettingsPath();
	const existing = readJsonFile<ClaudeCodeSettings>(settingsPath) || {};

	const updated: ClaudeCodeSettings = {
		...existing,
		mcpServers: {
			...existing.mcpServers,
			'local-pr-reviewer': {
				type: 'local',
				command: getMcpCommand(),
			},
		},
	};

	try {
		writeJsonFile(settingsPath, updated);
		return { success: true, path: settingsPath };
	} catch {
		return { success: false, path: settingsPath };
	}
}

/**
 * Configure MCP for OpenCode
 */
export function configureOpenCode(): { success: boolean; path: string } {
	const configPath = getOpenCodeConfigPath();
	const existing = readJsonFile<OpenCodeConfig>(configPath) || {};

	const updated: OpenCodeConfig = {
		...existing,
		mcp: {
			...existing.mcp,
			'local-pr-reviewer': {
				type: 'local',
				command: getMcpCommand(),
			},
		},
	};

	try {
		writeJsonFile(configPath, updated);
		return { success: true, path: configPath };
	} catch {
		return { success: false, path: configPath };
	}
}

/**
 * Configure MCP for specified agent
 */
export function configureMcp(agent: CodingAgent): {
	success: boolean;
	path: string;
} {
	switch (agent) {
		case 'claude-code':
			return configureClaudeCode();
		case 'opencode':
			return configureOpenCode();
	}
}

/**
 * Check if MCP is configured for Claude Code
 */
export function isClaudeCodeConfigured(): boolean {
	const settingsPath = getClaudeCodeSettingsPath();
	const settings = readJsonFile<ClaudeCodeSettings>(settingsPath);
	return !!settings?.mcpServers?.['local-pr-reviewer'];
}

/**
 * Check if MCP is configured for OpenCode
 */
export function isOpenCodeConfigured(): boolean {
	const configPath = getOpenCodeConfigPath();
	const config = readJsonFile<OpenCodeConfig>(configPath);
	return !!config?.mcp?.['local-pr-reviewer'];
}

/**
 * Detect which coding agents have config files present
 */
export function detectAvailableAgents(): CodingAgent[] {
	const agents: CodingAgent[] = [];

	if (
		existsSync(getClaudeCodeSettingsPath()) ||
		existsSync(dirname(getClaudeCodeSettingsPath()))
	) {
		agents.push('claude-code');
	}

	if (
		existsSync(getOpenCodeConfigPath()) ||
		existsSync(dirname(getOpenCodeConfigPath()))
	) {
		agents.push('opencode');
	}

	return agents;
}
