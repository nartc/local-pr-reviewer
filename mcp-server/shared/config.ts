// Effect-based configuration for MCP server
// No process.env access in implementation code - all env access goes through here

import { Path } from '@effect/platform';
import { Config, ConfigError, Context, Effect, Layer } from 'effect';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ES module equivalent of __dirname - must be computed at module load time
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Client detection environment variables
const clientEnvVars = [
	{ key: 'CLAUDE_CODE', name: 'Claude Code' },
	{ key: 'CURSOR_SESSION', name: 'Cursor' },
	{ key: 'CLINE_SESSION', name: 'Cline' },
	{ key: 'CONTINUE_SESSION', name: 'Continue.dev' },
	{ key: 'ZED_SESSION', name: 'Zed' },
] as const;

// Configuration values
export interface McpConfig {
	readonly workingDir: string;
	readonly clientName: string;
	readonly dbPaths: readonly string[];
}

export const McpConfig = Context.GenericTag<McpConfig>('McpConfig');

// Detect client name from environment using Config
const detectClientName: Effect.Effect<string, ConfigError.ConfigError> =
	Effect.gen(function* () {
		for (const { key, name } of clientEnvVars) {
			const value = yield* Config.string(key).pipe(
				Config.withDefault(''),
			);
			if (value) return name;
		}
		return 'Unknown Agent';
	});

// Build possible DB paths based on working directory
const buildDbPaths = (path: Path.Path, cwd: string): readonly string[] =>
	[
		path.join(cwd, 'db', 'pr-reviewer.db'),
		// Fallback paths for when MCP server runs from different locations
		path.join(__dirname, '..', '..', '..', 'db', 'pr-reviewer.db'),
		path.join(__dirname, '..', '..', 'db', 'pr-reviewer.db'),
	] as const;

// Create config from environment
const makeConfig: Effect.Effect<McpConfig, ConfigError.ConfigError, Path.Path> =
	Effect.gen(function* () {
		const path = yield* Path.Path;

		// CWD config - use PWD env var or fallback to process.cwd() via sync
		const workingDir = yield* Config.string('PWD').pipe(
			Config.orElse(() => Config.succeed(process.cwd())),
		);

		const clientName = yield* detectClientName;
		const dbPaths = buildDbPaths(path, workingDir);

		return {
			workingDir,
			clientName,
			dbPaths,
		} satisfies McpConfig;
	});

// Live layer - reads from environment once at startup
// Config errors are converted to defects (will crash on startup if config is invalid)
// Requires Path service to be provided
export const McpConfigLive = Layer.effect(
	McpConfig,
	makeConfig.pipe(
		Effect.tap((config) =>
			Effect.logDebug('MCP Config initialized', {
				workingDir: config.workingDir,
				clientName: config.clientName,
			}),
		),
		Effect.orDie, // Convert ConfigError to defect - fail fast on bad config
	),
);
