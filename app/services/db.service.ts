import { FileSystem, Path } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import Database from 'better-sqlite3';
import { Context, Effect, Layer } from 'effect';
import { DatabaseError } from '../lib/errors';

// Database service interface
export interface DbService {
	readonly db: Database.Database;
	readonly run: <T>(
		fn: (db: Database.Database) => T,
	) => Effect.Effect<T, DatabaseError>;
}

export const DbService = Context.GenericTag<DbService>('DbService');

// Singleton database instance
let dbInstance: Database.Database | null = null;

// Live implementation - effectful layer that runs migrations on init
export const DbServiceLive = Layer.effect(
	DbService,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const dbDir = path.join(process.cwd(), 'db');
		const dbPath = path.join(dbDir, 'pr-reviewer.db');

		if (!dbInstance) {
			// Create database connection
			dbInstance = new Database(dbPath);
			dbInstance.pragma('journal_mode = WAL');
			dbInstance.pragma('foreign_keys = ON');

			// Run base schema
			const schemaPath = path.join(dbDir, 'schema.sql');
			const schema = yield* fs.readFileString(schemaPath);
			dbInstance.exec(schema);

			// Run migrations
			const migrationsDir = path.join(dbDir, 'migrations');
			const exists = yield* fs.exists(migrationsDir);

			if (exists) {
				const entries = yield* fs.readDirectory(migrationsDir);
				const migrations = entries
					.filter((f) => f.endsWith('.sql'))
					.sort();

				for (const migration of migrations) {
					const migrationPath = path.join(migrationsDir, migration);
					const sql = yield* fs.readFileString(migrationPath);
					try {
						dbInstance.exec(sql);
					} catch (error) {
						// Ignore "duplicate column" or "already exists" errors
						const message =
							error instanceof Error
								? error.message
								: String(error);
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
).pipe(Layer.provide(NodeContext.layer));

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
