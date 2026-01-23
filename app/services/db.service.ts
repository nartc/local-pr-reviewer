import { FileSystem } from '@effect/platform';
import { NodeFileSystem } from '@effect/platform-node';
import Database from 'better-sqlite3';
import { Context, Effect, Layer } from 'effect';
import { join } from 'path';
import { DatabaseError } from '../lib/errors';

// Database service interface
export interface DbService {
	readonly db: Database.Database;
	readonly run: <T>(
		fn: (db: Database.Database) => T,
	) => Effect.Effect<T, DatabaseError>;
}

export const DbService = Context.GenericTag<DbService>('DbService');

// Database file path
const DB_PATH = join(process.cwd(), 'db', 'pr-reviewer.db');
const DB_DIR = join(process.cwd(), 'db');

// Create database connection
const createDatabase = (): Database.Database => {
	const db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
};

// Run schema and migrations using Effect FileSystem
const runMigrations = (db: Database.Database) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		// Run base schema
		const schemaPath = join(DB_DIR, 'schema.sql');
		const schema = yield* fs.readFileString(schemaPath);
		db.exec(schema);

		// Run migrations
		const migrationsDir = join(DB_DIR, 'migrations');
		const exists = yield* fs.exists(migrationsDir);

		if (exists) {
			const entries = yield* fs.readDirectory(migrationsDir);
			const migrations = entries.filter((f) => f.endsWith('.sql')).sort();

			for (const migration of migrations) {
				const migrationPath = join(migrationsDir, migration);
				const sql = yield* fs.readFileString(migrationPath);
				try {
					db.exec(sql);
				} catch (error) {
					// Ignore "duplicate column" or "already exists" errors
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

		return db;
	});

// Singleton database instance
let dbInstance: Database.Database | null = null;

// Live implementation - effectful layer that runs migrations on init
export const DbServiceLive = Layer.effect(
	DbService,
	Effect.gen(function* () {
		if (!dbInstance) {
			dbInstance = createDatabase();
			yield* runMigrations(dbInstance);
			yield* Effect.logDebug('Database initialized with migrations');
		}

		return DbService.of({
			db: dbInstance,
			run: <T>(fn: (db: Database.Database) => T) =>
				Effect.try({
					try: () => fn(dbInstance!),
					catch: (error) =>
						new DatabaseError({
							message:
								error instanceof Error
									? error.message
									: 'Database error',
							cause: error,
						}),
				}),
		});
	}),
).pipe(Layer.provide(NodeFileSystem.layer));

// Helper functions for common operations
export const query = <T>(
	sql: string,
	params: unknown[] = [],
): Effect.Effect<T[], DatabaseError, DbService> =>
	Effect.gen(function* () {
		const { run } = yield* DbService;
		return yield* run((db) => db.prepare(sql).all(...params) as T[]);
	});

export const queryOne = <T>(
	sql: string,
	params: unknown[] = [],
): Effect.Effect<T | undefined, DatabaseError, DbService> =>
	Effect.gen(function* () {
		const { run } = yield* DbService;
		return yield* run(
			(db) => db.prepare(sql).get(...params) as T | undefined,
		);
	});

export const execute = (
	sql: string,
	params: unknown[] = [],
): Effect.Effect<Database.RunResult, DatabaseError, DbService> =>
	Effect.gen(function* () {
		const { run } = yield* DbService;
		return yield* run((db) => db.prepare(sql).run(...params));
	});

// Direct access for use outside Effect context
export const getDatabase = (): Database.Database => {
	if (!dbInstance) {
		throw new Error(
			'Database not initialized. Ensure DbServiceLive layer is provided.',
		);
	}
	return dbInstance;
};
