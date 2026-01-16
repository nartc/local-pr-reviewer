import Database from 'better-sqlite3';
import { Context, Effect, Layer } from 'effect';
import { readFileSync } from 'fs';
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

// Create database connection
const createDatabase = (): Database.Database => {
	const db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
};

// Run migrations
const runMigrations = (db: Database.Database): void => {
	const schemaPath = join(process.cwd(), 'db', 'schema.sql');
	const schema = readFileSync(schemaPath, 'utf-8');
	db.exec(schema);
};

// Singleton database instance
let dbInstance: Database.Database | null = null;

const getDb = (): Database.Database => {
	if (!dbInstance) {
		dbInstance = createDatabase();
		runMigrations(dbInstance);
	}
	return dbInstance;
};

// Live implementation
export const DbServiceLive = Layer.succeed(
	DbService,
	DbService.of({
		db: getDb(),
		run: <T>(fn: (db: Database.Database) => T) =>
			Effect.try({
				try: () => fn(getDb()),
				catch: (error) =>
					new DatabaseError({
						message:
							error instanceof Error
								? error.message
								: 'Database error',
						cause: error,
					}),
			}),
	}),
);

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
export const getDatabase = (): Database.Database => getDb();
