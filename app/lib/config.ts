import { Context, Layer } from 'effect';

// Config schema
export interface AppConfig {
	readonly aiProvider: string | undefined;
	readonly googleApiKey: string | undefined;
	readonly openaiApiKey: string | undefined;
	readonly anthropicApiKey: string | undefined;
	readonly repoScanMaxDepth: number;
	/**
	 * List of absolute paths to scan for git repositories.
	 * Configured via REPO_SCAN_ROOT env var (comma-separated).
	 * Example: REPO_SCAN_ROOT=/Users/me/code,/Users/me/projects
	 */
	readonly repoScanRoots: string[];
}

// Config service interface
export interface ConfigService {
	readonly config: AppConfig;
}

export const ConfigService = Context.GenericTag<ConfigService>('ConfigService');

/**
 * Parse comma-separated paths from REPO_SCAN_ROOT env var.
 * Filters out empty strings and trims whitespace.
 */
function parseRepoScanRoots(): string[] {
	const envValue = process.env.REPO_SCAN_ROOT;
	if (!envValue) {
		// Default to home directory if not specified
		return [process.env.HOME || '/'];
	}
	return envValue
		.split(',')
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
}

// Live implementation - loads config from environment
export const ConfigServiceLive = Layer.succeed(
	ConfigService,
	ConfigService.of({
		config: {
			aiProvider: process.env.AI_PROVIDER || undefined,
			googleApiKey: process.env.GOOGLE_API_KEY || undefined,
			openaiApiKey: process.env.OPENAI_API_KEY || undefined,
			anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
			repoScanMaxDepth: parseInt(
				process.env.REPO_SCAN_MAX_DEPTH || '3',
				10,
			),
			repoScanRoots: parseRepoScanRoots(),
		},
	}),
);
