// Version management for local-pr-reviewer

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getVersionJsonPath } from './paths.js';

export interface VersionInfo {
	version: string;
	installedAt: string;
	updatedAt: string;
}

/**
 * Get the current CLI version from package.json
 */
export function getCliVersion(): string {
	// This will be replaced during build or read from package.json
	return '1.0.0';
}

/**
 * Parse version string into major, minor, patch
 */
export function parseVersion(version: string): {
	major: number;
	minor: number;
	patch: number;
} {
	const [major, minor, patch] = version.split('.').map(Number);
	return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

/**
 * Check if there's a breaking change between versions
 */
export function isBreakingChange(
	oldVersion: string,
	newVersion: string,
): boolean {
	const oldParsed = parseVersion(oldVersion);
	const newParsed = parseVersion(newVersion);
	return oldParsed.major !== newParsed.major;
}

/**
 * Check if update is available
 */
export function isNewerVersion(
	installedVersion: string,
	currentVersion: string,
): boolean {
	const installed = parseVersion(installedVersion);
	const current = parseVersion(currentVersion);

	if (current.major > installed.major) return true;
	if (current.major < installed.major) return false;
	if (current.minor > installed.minor) return true;
	if (current.minor < installed.minor) return false;
	return current.patch > installed.patch;
}

/**
 * Read installed version info
 */
export function readVersionInfo(): VersionInfo | null {
	const versionPath = getVersionJsonPath();
	if (!existsSync(versionPath)) {
		return null;
	}
	try {
		const content = readFileSync(versionPath, 'utf-8');
		return JSON.parse(content) as VersionInfo;
	} catch {
		return null;
	}
}

/**
 * Write version info
 */
export function writeVersionInfo(version: string): void {
	const versionPath = getVersionJsonPath();
	const now = new Date().toISOString();
	const existing = readVersionInfo();

	const info: VersionInfo = {
		version,
		installedAt: existing?.installedAt || now,
		updatedAt: now,
	};

	writeFileSync(versionPath, JSON.stringify(info, null, 2));
}
