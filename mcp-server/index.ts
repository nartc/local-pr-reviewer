#!/usr/bin/env node
// PR Reviewer MCP Server
// Provides tools for coding agents to receive and manage PR review comments

import { NodeContext } from '@effect/platform-node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Effect, Layer, Logger, LogLevel, ManagedRuntime } from 'effect';
import { z } from 'zod';

import { McpConfig, McpConfigLive } from './shared/config.js';
import { DbService, DbServiceLive, generateId } from './shared/db.js';
import { checkComments } from './tools/check-comments.js';
import { getDetails } from './tools/get-details.js';
import { listPending } from './tools/list-pending.js';
import { listRepoPending } from './tools/list-repo-pending.js';
import { markResolved } from './tools/mark-resolved.js';

// Logging layer - stderr for MCP (stdout is reserved for protocol)
const LoggingLive = Layer.mergeAll(
	Logger.replace(
		Logger.defaultLogger,
		Logger.make(({ logLevel, message, annotations, date }) => {
			if (logLevel._tag === 'Debug' || logLevel._tag === 'Trace') return;
			const level = logLevel._tag.toUpperCase();
			const annotationStr = Object.keys(annotations).length
				? ` ${JSON.stringify(annotations)}`
				: '';
			console.error(
				`[${date.toISOString()}] ${level}: ${message}${annotationStr}`,
			);
		}),
	),
	Logger.minimumLogLevel(LogLevel.Info),
);

// App layer with all services - proper dependency chain
const AppLayer = DbServiceLive.pipe(
	Layer.provideMerge(McpConfigLive),
	Layer.provide(LoggingLive),
	Layer.provide(NodeContext.layer),
);

// Runtime instance
const runtime = ManagedRuntime.make(AppLayer);

// Track client for this session
let currentClientId: string | null = null;

const getOrCreateClient = Effect.gen(function* () {
	const db = yield* DbService;
	const config = yield* McpConfig;

	if (currentClientId) {
		// Update last seen
		yield* db
			.execute(
				`UPDATE mcp_clients SET last_seen_at = datetime('now') WHERE id = ?`,
				[currentClientId],
			)
			.pipe(Effect.catchAll(() => Effect.succeed({ changes: 0 })));
		return currentClientId;
	}

	// Create new client record
	currentClientId = generateId();

	yield* db
		.execute(
			`INSERT INTO mcp_clients (id, client_name, working_dir, connected_at, last_seen_at)
			 VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
			[currentClientId, config.clientName, config.workingDir],
		)
		.pipe(Effect.catchAll(() => Effect.succeed({ changes: 0 })));

	yield* Effect.logInfo('MCP client connected').pipe(
		Effect.annotateLogs({
			clientId: currentClientId,
			clientName: config.clientName,
			workingDir: config.workingDir,
		}),
	);

	return currentClientId;
});

// Create MCP server with new API
const server = new McpServer({
	name: 'pr-reviewer',
	version: '2.0.0',
});

// Register tools with Zod schemas
server.tool(
	'check_pr_comments',
	'Check for pending PR review comments in the current repository. Returns comments that have been sent from the PR Reviewer UI and marks them as delivered.',
	{
		repo_path: z
			.string()
			.optional()
			.describe(
				'Optional: Repository path (auto-detected from cwd if not provided)',
			),
	},
	async ({ repo_path }) => {
		const program = Effect.gen(function* () {
			const clientId = yield* getOrCreateClient;
			return yield* checkComments({ repo_path }, clientId);
		}).pipe(
			Effect.catchAll((error) =>
				Effect.gen(function* () {
					const message =
						'message' in error
							? (error.message as string)
							: String(error);
					yield* Effect.logError('Tool error').pipe(
						Effect.annotateLogs({
							tool: 'check_pr_comments',
							error: message,
						}),
					);

					if (error._tag === 'RepoNotFoundError') {
						return `No repository registered at path: ${(error as { path: string }).path}\n\nTo use this tool, first open the PR Reviewer UI and select this repository.`;
					}
					if (error._tag === 'SessionNotFoundError') {
						return `No active review session found for ${(error as { repoName: string }).repoName}.\n\nOpen the PR Reviewer UI to start a review session.`;
					}

					return `Error: ${message}`;
				}),
			),
			Effect.withSpan('mcp.tool.check_pr_comments'),
		);

		const result = await runtime.runPromise(program);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'mark_comment_resolved',
	'Mark a PR review comment as resolved after addressing it. Use the comment ID from check_pr_comments.',
	{
		comment_id: z.string().describe('The comment ID to mark as resolved'),
	},
	async ({ comment_id }) => {
		const program = Effect.gen(function* () {
			yield* getOrCreateClient;
			return yield* markResolved({ comment_id });
		}).pipe(
			Effect.catchAll((error) =>
				Effect.gen(function* () {
					const message =
						'message' in error
							? (error.message as string)
							: String(error);
					yield* Effect.logError('Tool error').pipe(
						Effect.annotateLogs({
							tool: 'mark_comment_resolved',
							error: message,
						}),
					);

					if (error._tag === 'CommentNotFoundError') {
						return `Comment not found: ${(error as { id: string }).id}`;
					}

					return `Error: ${message}`;
				}),
			),
			Effect.withSpan('mcp.tool.mark_comment_resolved'),
		);

		const result = await runtime.runPromise(program);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'list_pending_comments',
	'List pending PR review comments across all registered repositories. Shows a summary of undelivered comments per repository.',
	{},
	async () => {
		const program = Effect.gen(function* () {
			yield* getOrCreateClient;
			return yield* listPending();
		}).pipe(
			Effect.catchAll((error) =>
				Effect.gen(function* () {
					const message =
						'message' in error
							? (error.message as string)
							: String(error);
					yield* Effect.logError('Tool error').pipe(
						Effect.annotateLogs({
							tool: 'list_pending_comments',
							error: message,
						}),
					);
					return `Error: ${message}`;
				}),
			),
			Effect.withSpan('mcp.tool.list_pending_comments'),
		);

		const result = await runtime.runPromise(program);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'list_repo_pending_comments',
	'List pending PR review comments for the current repository only. Shows a summary grouped by file.',
	{
		repo_path: z
			.string()
			.optional()
			.describe(
				'Optional: Repository path (auto-detected from cwd if not provided)',
			),
	},
	async ({ repo_path }) => {
		const program = Effect.gen(function* () {
			yield* getOrCreateClient;
			return yield* listRepoPending({ repo_path });
		}).pipe(
			Effect.catchAll((error) =>
				Effect.gen(function* () {
					const message =
						'message' in error
							? (error.message as string)
							: String(error);
					yield* Effect.logError('Tool error').pipe(
						Effect.annotateLogs({
							tool: 'list_repo_pending_comments',
							error: message,
						}),
					);

					if (error._tag === 'RepoNotFoundError') {
						return `No repository registered at path: ${(error as { path: string }).path}\n\nTo use this tool, first open the PR Reviewer UI and select this repository.`;
					}
					if (error._tag === 'SessionNotFoundError') {
						return `No active review session found for ${(error as { repoName: string }).repoName}.\n\nOpen the PR Reviewer UI to start a review session.`;
					}

					return `Error: ${message}`;
				}),
			),
			Effect.withSpan('mcp.tool.list_repo_pending_comments'),
		);

		const result = await runtime.runPromise(program);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'get_comment_details',
	'Get detailed information about a specific PR review comment, including file path, line numbers, content, and status.',
	{
		comment_id: z.string().describe('The comment ID to get details for'),
	},
	async ({ comment_id }) => {
		const program = Effect.gen(function* () {
			yield* getOrCreateClient;
			return yield* getDetails({ comment_id });
		}).pipe(
			Effect.catchAll((error) =>
				Effect.gen(function* () {
					const message =
						'message' in error
							? (error.message as string)
							: String(error);
					yield* Effect.logError('Tool error').pipe(
						Effect.annotateLogs({
							tool: 'get_comment_details',
							error: message,
						}),
					);

					if (error._tag === 'CommentNotFoundError') {
						return `Comment not found: ${(error as { id: string }).id}`;
					}

					return `Error: ${message}`;
				}),
			),
			Effect.withSpan('mcp.tool.get_comment_details'),
		);

		const result = await runtime.runPromise(program);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

// Start the server
const main = async () => {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('PR Reviewer MCP server started');
};

main().catch((error) => {
	console.error('Failed to start MCP server:', error);
	process.exit(1);
});
