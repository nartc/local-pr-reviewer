// Server-only utilities for signal file management

import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';

const SIGNAL_FILE_NAME = '.local-pr-reviewer-pending';
const GITIGNORE_ENTRY =
	'\n# Local PR Reviewer signal file\n.local-pr-reviewer-pending\n';

interface Preferences {
	autoCreateSignalFile?: boolean;
}

/**
 * Get the global preferences path
 */
const getPreferencesPath = Effect.gen(function* () {
	const path = yield* Path.Path;
	const xdgConfig = process.env.XDG_CONFIG_HOME;
	const home = process.env.HOME || '';
	const configBase = xdgConfig || path.join(home, '.config');
	return path.join(configBase, 'local-pr-reviewer', 'preferences.json');
});

/**
 * Read global preferences
 */
const readPreferences = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const prefsPath = yield* getPreferencesPath;

	const exists = yield* fs.exists(prefsPath);
	if (!exists) {
		return {} as Preferences;
	}

	return yield* fs.readFileString(prefsPath).pipe(
		Effect.map((content) => JSON.parse(content) as Preferences),
		Effect.catchAll(() => Effect.succeed({} as Preferences)),
	);
});

/**
 * Write global preferences
 */
const writePreferences = (prefs: Preferences) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const prefsPath = yield* getPreferencesPath;
		const dir = path.dirname(prefsPath);

		const dirExists = yield* fs.exists(dir);
		if (!dirExists) {
			yield* fs.makeDirectory(dir, { recursive: true });
		}

		yield* fs.writeFileString(prefsPath, JSON.stringify(prefs, null, 2));
	});

/**
 * Check if signal file setup is needed and if auto-confirm is enabled
 */
export const checkSignalFileStatus = (repoPath: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const signalPath = path.join(repoPath, SIGNAL_FILE_NAME);
		const exists = yield* fs.exists(signalPath);
		const prefs = yield* readPreferences;
		const autoConfirm = prefs.autoCreateSignalFile === true;

		return { exists, autoConfirm };
	});

/**
 * Create signal file and update gitignore
 */
export const createSignalFile = (repoPath: string, remember: boolean) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const signalPath = path.join(repoPath, SIGNAL_FILE_NAME);
		const gitignorePath = path.join(repoPath, '.gitignore');

		let warning: string | undefined;

		// Create empty signal file
		const createResult = yield* fs.writeFileString(signalPath, '').pipe(
			Effect.map(() => ({ success: true as const })),
			Effect.catchAll((error) =>
				Effect.succeed({
					success: false as const,
					error: `Failed to create signal file: ${error instanceof Error ? error.message : 'Unknown error'}`,
				}),
			),
		);

		if (!createResult.success) {
			return {
				success: false,
				error: createResult.error,
			};
		}

		// Try to update .gitignore
		const gitignoreExists = yield* fs.exists(gitignorePath);
		yield* Effect.gen(function* () {
			if (gitignoreExists) {
				const content = yield* fs.readFileString(gitignorePath);
				if (!content.includes(SIGNAL_FILE_NAME)) {
					yield* fs.writeFileString(
						gitignorePath,
						content + GITIGNORE_ENTRY,
					);
				}
			} else {
				yield* fs.writeFileString(
					gitignorePath,
					GITIGNORE_ENTRY.trimStart(),
				);
			}
		}).pipe(
			Effect.catchAll(() => {
				warning = `Could not update .gitignore - please add '${SIGNAL_FILE_NAME}' manually`;
				return Effect.void;
			}),
		);

		// Update preferences if remember is true
		if (remember) {
			yield* readPreferences.pipe(
				Effect.flatMap((prefs) => {
					prefs.autoCreateSignalFile = true;
					return writePreferences(prefs);
				}),
				Effect.catchAll(() => Effect.void),
			);
		}

		return {
			success: true,
			warning,
			signalPath,
		};
	});

/**
 * Update signal file to notify MCP clients of pending comments
 * Writes current timestamp to trigger file watchers
 */
export const updateSignalFile = (repoPath: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const signalPath = path.join(repoPath, SIGNAL_FILE_NAME);

		// Only update if signal file exists (user opted in)
		const exists = yield* fs.exists(signalPath);
		if (!exists) {
			return false;
		}

		yield* fs.writeFileString(signalPath, new Date().toISOString());
		return true;
	}).pipe(Effect.catchAll(() => Effect.succeed(false)));

/**
 * Get the signal file name constant
 */
export const getSignalFileName = () => SIGNAL_FILE_NAME;
