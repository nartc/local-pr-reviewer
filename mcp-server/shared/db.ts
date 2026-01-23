// Database service for MCP server using Effect
import { FileSystem, Path } from '@effect/platform';
import Database from 'better-sqlite3';
import { Context, Data, Effect, Layer } from 'effect';
import { McpConfig } from './config.js';

// Errors
export class DatabaseError extends Data.TaggedError('DatabaseError')<{
	message: string;
	cause?: unknown;
}> {}

export class RepoNotFoundError extends Data.TaggedError('RepoNotFoundError')<{
	path: string;
}> {}

export class SessionNotFoundError extends Data.TaggedError(
	'SessionNotFoundError',
)<{
	repoName: string;
}> {}

export class CommentNotFoundError extends Data.TaggedError(
	'CommentNotFoundError',
)<{
	id: string;
}> {}

// Service interface
export interface DbService {
	readonly query: <T>(
		sql: string,
		params?: unknown[],
	) => Effect.Effect<T[], DatabaseError>;
	readonly queryOne: <T>(
		sql: string,
		params?: unknown[],
	) => Effect.Effect<T | undefined, DatabaseError>;
	readonly execute: (
		sql: string,
		params?: unknown[],
	) => Effect.Effect<Database.RunResult, DatabaseError>;
}

export const DbService = Context.GenericTag<DbService>('McpDbService');

// Create DbService implementation with a database instance
const makeDbService = (db: Database.Database): DbService => ({
	query: <T>(sql: string, params: unknown[] = []) =>
		Effect.try({
			try: () => db.prepare(sql).all(...params) as T[],
			catch: (error) =>
				new DatabaseError({
					message:
						error instanceof Error ? error.message : 'Query failed',
					cause: error,
				}),
		}).pipe(Effect.withSpan('db.query', { attributes: { sql } })),

	queryOne: <T>(sql: string, params: unknown[] = []) =>
		Effect.try({
			try: () => db.prepare(sql).get(...params) as T | undefined,
			catch: (error) =>
				new DatabaseError({
					message:
						error instanceof Error ? error.message : 'Query failed',
					cause: error,
				}),
		}).pipe(Effect.withSpan('db.queryOne', { attributes: { sql } })),

	execute: (sql: string, params: unknown[] = []) =>
		Effect.try({
			try: () => db.prepare(sql).run(...params),
			catch: (error) =>
				new DatabaseError({
					message:
						error instanceof Error
							? error.message
							: 'Execute failed',
					cause: error,
				}),
		}).pipe(Effect.withSpan('db.execute', { attributes: { sql } })),
});

// Live layer - depends on McpConfig, FileSystem, and Path
export const DbServiceLive = Layer.effect(
	DbService,
	Effect.gen(function* () {
		const config = yield* McpConfig;
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		// Find first existing DB path or use first as default
		let dbPath = config.dbPaths[0];
		for (const candidatePath of config.dbPaths) {
			const exists = yield* fs.exists(candidatePath);
			if (exists) {
				dbPath = candidatePath;
				break;
			}
		}

		const dbDir = path.dirname(dbPath);

		const db = new Database(dbPath);
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');

		// Run base schema
		const schemaPath = path.join(dbDir, 'schema.sql');
		const schemaExists = yield* fs.exists(schemaPath);
		if (schemaExists) {
			const schema = yield* fs.readFileString(schemaPath);
			db.exec(schema);
		}

		// Run migrations
		const migrationsDir = path.join(dbDir, 'migrations');
		const migrationsDirExists = yield* fs.exists(migrationsDir);
		if (migrationsDirExists) {
			const entries = yield* fs.readDirectory(migrationsDir);
			const migrations = entries.filter((f) => f.endsWith('.sql')).sort();

			for (const migration of migrations) {
				const migrationPath = path.join(migrationsDir, migration);
				const sql = yield* fs.readFileString(migrationPath);
				try {
					db.exec(sql);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					if (
						!message.includes('duplicate column') &&
						!message.includes('already exists')
					) {
						yield* Effect.logWarning(
							`Migration ${migration} failed: ${message}`,
						);
					}
				}
			}
		}

		yield* Effect.logInfo('Database initialized', { path: dbPath });

		return makeDbService(db);
	}),
);

// Generate unique ID
export const generateId = (): string => crypto.randomUUID();
