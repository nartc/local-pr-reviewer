// Server-only utilities for signal file management

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const SIGNAL_FILE_NAME = '.local-pr-reviewer-pending';
const GITIGNORE_ENTRY =
	'\n# Local PR Reviewer signal file\n.local-pr-reviewer-pending\n';

/**
 * Get the global preferences path
 */
function getPreferencesPath(): string {
	const xdgConfig = process.env.XDG_CONFIG_HOME;
	const configBase = xdgConfig || join(homedir(), '.config');
	return join(configBase, 'local-pr-reviewer', 'preferences.json');
}

interface Preferences {
	autoCreateSignalFile?: boolean;
}

/**
 * Read global preferences
 */
function readPreferences(): Preferences {
	const prefsPath = getPreferencesPath();
	if (!existsSync(prefsPath)) {
		return {};
	}
	try {
		const content = readFileSync(prefsPath, 'utf-8');
		return JSON.parse(content) as Preferences;
	} catch {
		return {};
	}
}

/**
 * Write global preferences
 */
function writePreferences(prefs: Preferences): void {
	const prefsPath = getPreferencesPath();
	const dir = dirname(prefsPath);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
}

/**
 * Check if signal file setup is needed and if auto-confirm is enabled
 */
export function checkSignalFileStatus(repoPath: string): {
	exists: boolean;
	autoConfirm: boolean;
} {
	const signalPath = join(repoPath, SIGNAL_FILE_NAME);
	const exists = existsSync(signalPath);
	const prefs = readPreferences();
	const autoConfirm = prefs.autoCreateSignalFile === true;

	return { exists, autoConfirm };
}

/**
 * Create signal file and update gitignore
 */
export function createSignalFile(
	repoPath: string,
	remember: boolean,
): {
	success: boolean;
	warning?: string;
	signalPath?: string;
	error?: string;
} {
	const signalPath = join(repoPath, SIGNAL_FILE_NAME);
	const gitignorePath = join(repoPath, '.gitignore');

	let warning: string | undefined;

	try {
		// Create empty signal file
		writeFileSync(signalPath, '');
	} catch (error) {
		return {
			success: false,
			error: `Failed to create signal file: ${error instanceof Error ? error.message : 'Unknown error'}`,
		};
	}

	// Try to update .gitignore
	try {
		if (existsSync(gitignorePath)) {
			const content = readFileSync(gitignorePath, 'utf-8');
			if (!content.includes(SIGNAL_FILE_NAME)) {
				appendFileSync(gitignorePath, GITIGNORE_ENTRY);
			}
		} else {
			// Create .gitignore with signal file entry
			writeFileSync(gitignorePath, GITIGNORE_ENTRY.trimStart());
		}
	} catch {
		// Noop but warn
		warning = `Could not update .gitignore - please add '${SIGNAL_FILE_NAME}' manually`;
	}

	// Update preferences if remember is true
	if (remember) {
		try {
			const prefs = readPreferences();
			prefs.autoCreateSignalFile = true;
			writePreferences(prefs);
		} catch {
			// Noop - preferences are optional
		}
	}

	return {
		success: true,
		warning,
		signalPath,
	};
}
