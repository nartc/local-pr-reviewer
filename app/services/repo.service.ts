import { Context, Effect, Layer } from 'effect';
import { generateId } from '../lib/effect-runtime';
import {
	DatabaseError,
	GitError,
	RepoNotFoundError,
	SessionNotFoundError,
} from '../lib/errors';
import { DbService, execute, query, queryOne } from './db.service';
import { GitService } from './git.service';

// Types
export interface Repo {
	id: string;
	remote_url: string | null;
	name: string;
	base_branch: string;
	created_at: string;
}

export interface RepoPath {
	id: string;
	repo_id: string;
	path: string;
	last_accessed_at: string | null;
	created_at: string;
}

export interface ReviewSession {
	id: string;
	repo_id: string;
	branch: string;
	base_branch: string | null;
	created_at: string;
}

export interface RepoWithPath extends Repo {
	paths: RepoPath[];
}

// RepoService interface
export interface RepoService {
	readonly getAllRepos: Effect.Effect<
		RepoWithPath[],
		DatabaseError,
		DbService
	>;
	readonly getRepoById: (
		id: string,
	) => Effect.Effect<Repo, RepoNotFoundError | DatabaseError, DbService>;
	readonly getRepoByRemoteUrl: (
		remoteUrl: string,
	) => Effect.Effect<Repo | undefined, DatabaseError, DbService>;
	readonly getRepoByPath: (
		path: string,
	) => Effect.Effect<Repo | undefined, DatabaseError, DbService>;
	readonly createOrGetRepoFromPath: (
		path: string,
	) => Effect.Effect<
		{ repo: Repo; repoPath: RepoPath; isNew: boolean },
		DatabaseError | GitError,
		DbService | GitService
	>;
	readonly deleteRepo: (
		id: string,
	) => Effect.Effect<void, DatabaseError, DbService>;
	readonly deleteRepoPath: (
		pathId: string,
	) => Effect.Effect<void, DatabaseError, DbService>;
	readonly updateBaseBranch: (
		repoId: string,
		baseBranch: string,
	) => Effect.Effect<void, DatabaseError, DbService>;
	readonly getOrCreateSession: (
		repoId: string,
		path: string,
	) => Effect.Effect<
		ReviewSession,
		DatabaseError | GitError,
		DbService | GitService
	>;
	readonly getSessionById: (
		id: string,
	) => Effect.Effect<
		ReviewSession,
		SessionNotFoundError | DatabaseError,
		DbService
	>;
	readonly getSessionWithRepo: (
		sessionId: string,
	) => Effect.Effect<
		{ session: ReviewSession; repo: RepoWithPath },
		SessionNotFoundError | RepoNotFoundError | DatabaseError,
		DbService
	>;
	readonly getRepoPaths: (
		repoId: string,
	) => Effect.Effect<RepoPath[], DatabaseError, DbService>;
	readonly updateSessionBaseBranch: (
		sessionId: string,
		baseBranch: string | null,
	) => Effect.Effect<void, DatabaseError, DbService>;
}

export const RepoService = Context.GenericTag<RepoService>('RepoService');

// Implementation
const makeRepoService = (): RepoService => ({
	getAllRepos: Effect.gen(function* () {
		const repos = yield* query<Repo>('SELECT * FROM repos ORDER BY name');

		return yield* Effect.all(
			repos.map((repo) =>
				query<RepoPath>(
					'SELECT * FROM repo_paths WHERE repo_id = ? ORDER BY last_accessed_at DESC',
					[repo.id],
				).pipe(Effect.map((paths) => ({ ...repo, paths }))),
			),
		);
	}).pipe(Effect.withSpan('repo.getAllRepos')),

	getRepoById: (id: string) =>
		Effect.gen(function* () {
			const repo = yield* queryOne<Repo>(
				'SELECT * FROM repos WHERE id = ?',
				[id],
			);

			if (!repo) {
				return yield* Effect.fail(new RepoNotFoundError({ id }));
			}

			return repo;
		}).pipe(Effect.withSpan('repo.getRepoById')),

	getRepoByRemoteUrl: (remoteUrl: string) =>
		queryOne<Repo>('SELECT * FROM repos WHERE remote_url = ?', [
			remoteUrl,
		]).pipe(Effect.withSpan('repo.getRepoByRemoteUrl')),

	getRepoByPath: (path: string) =>
		Effect.gen(function* () {
			const repoPath = yield* queryOne<RepoPath>(
				'SELECT * FROM repo_paths WHERE path = ?',
				[path],
			);

			if (!repoPath) return undefined;

			return yield* queryOne<Repo>('SELECT * FROM repos WHERE id = ?', [
				repoPath.repo_id,
			]);
		}).pipe(Effect.withSpan('repo.getRepoByPath')),

	createOrGetRepoFromPath: (path: string) =>
		Effect.gen(function* () {
			const git = yield* GitService;

			// Check if path already registered
			const existingPath = yield* queryOne<RepoPath>(
				'SELECT * FROM repo_paths WHERE path = ?',
				[path],
			);

			if (existingPath) {
				const repo = yield* queryOne<Repo>(
					'SELECT * FROM repos WHERE id = ?',
					[existingPath.repo_id],
				);

				yield* execute(
					"UPDATE repo_paths SET last_accessed_at = datetime('now') WHERE id = ?",
					[existingPath.id],
				);

				return { repo: repo!, repoPath: existingPath, isNew: false };
			}

			// Get git info
			const remoteUrl = yield* git
				.getRemoteUrl(path)
				.pipe(Effect.catchAll(() => Effect.succeed(null)));

			const repoName = path.split('/').pop() || 'unknown';

			// Check if repo with same remote exists
			let repo: Repo | undefined;
			if (remoteUrl) {
				repo = yield* queryOne<Repo>(
					'SELECT * FROM repos WHERE remote_url = ?',
					[remoteUrl],
				);
			}

			// Create repo if not exists
			if (!repo) {
				const repoId = generateId();
				const baseBranch = yield* git
					.getDefaultBranch(path)
					.pipe(Effect.catchAll(() => Effect.succeed('main')));

				yield* execute(
					'INSERT INTO repos (id, remote_url, name, base_branch) VALUES (?, ?, ?, ?)',
					[repoId, remoteUrl, repoName, baseBranch],
				);

				repo = yield* queryOne<Repo>(
					'SELECT * FROM repos WHERE id = ?',
					[repoId],
				);
			}

			// Create repo path
			const pathId = generateId();
			yield* execute(
				"INSERT INTO repo_paths (id, repo_id, path, last_accessed_at) VALUES (?, ?, ?, datetime('now'))",
				[pathId, repo!.id, path],
			);

			const repoPath = yield* queryOne<RepoPath>(
				'SELECT * FROM repo_paths WHERE id = ?',
				[pathId],
			);

			yield* Effect.logInfo(`Created repo: ${repo!.name} at ${path}`);

			return { repo: repo!, repoPath: repoPath!, isNew: true };
		}).pipe(Effect.withSpan('repo.createOrGetRepoFromPath')),

	deleteRepo: (id: string) =>
		execute('DELETE FROM repos WHERE id = ?', [id]).pipe(
			Effect.map(() => undefined),
			Effect.withSpan('repo.deleteRepo'),
		),

	deleteRepoPath: (pathId: string) =>
		Effect.gen(function* () {
			const repoPath = yield* queryOne<RepoPath>(
				'SELECT * FROM repo_paths WHERE id = ?',
				[pathId],
			);

			if (!repoPath) return;

			yield* execute('DELETE FROM repo_paths WHERE id = ?', [pathId]);

			// Check if repo has any other paths
			const otherPaths = yield* queryOne<{ count: number }>(
				'SELECT COUNT(*) as count FROM repo_paths WHERE repo_id = ?',
				[repoPath.repo_id],
			);

			if (otherPaths?.count === 0) {
				yield* execute('DELETE FROM repos WHERE id = ?', [
					repoPath.repo_id,
				]);
			}
		}).pipe(Effect.withSpan('repo.deleteRepoPath')),

	updateBaseBranch: (repoId: string, baseBranch: string) =>
		execute('UPDATE repos SET base_branch = ? WHERE id = ?', [
			baseBranch,
			repoId,
		]).pipe(
			Effect.map(() => undefined),
			Effect.withSpan('repo.updateBaseBranch'),
		),

	getOrCreateSession: (repoId: string, path: string) =>
		Effect.gen(function* () {
			const git = yield* GitService;

			const currentBranch = yield* git.getCurrentBranch(path);

			const existing = yield* queryOne<ReviewSession>(
				'SELECT * FROM review_sessions WHERE repo_id = ? AND branch = ?',
				[repoId, currentBranch],
			);

			if (existing) return existing;

			const sessionId = generateId();
			yield* execute(
				'INSERT INTO review_sessions (id, repo_id, branch) VALUES (?, ?, ?)',
				[sessionId, repoId, currentBranch],
			);

			const session = yield* queryOne<ReviewSession>(
				'SELECT * FROM review_sessions WHERE id = ?',
				[sessionId],
			);

			return session!;
		}).pipe(Effect.withSpan('repo.getOrCreateSession')),

	getSessionById: (id: string) =>
		Effect.gen(function* () {
			const session = yield* queryOne<ReviewSession>(
				'SELECT * FROM review_sessions WHERE id = ?',
				[id],
			);

			if (!session) {
				return yield* Effect.fail(new SessionNotFoundError({ id }));
			}

			return session;
		}).pipe(Effect.withSpan('repo.getSessionById')),

	getSessionWithRepo: (sessionId: string) =>
		Effect.gen(function* () {
			const session = yield* queryOne<ReviewSession>(
				'SELECT * FROM review_sessions WHERE id = ?',
				[sessionId],
			);

			if (!session) {
				return yield* Effect.fail(
					new SessionNotFoundError({ id: sessionId }),
				);
			}

			const repo = yield* queryOne<Repo>(
				'SELECT * FROM repos WHERE id = ?',
				[session.repo_id],
			);

			if (!repo) {
				return yield* Effect.fail(
					new RepoNotFoundError({ id: session.repo_id }),
				);
			}

			const paths = yield* query<RepoPath>(
				'SELECT * FROM repo_paths WHERE repo_id = ? ORDER BY last_accessed_at DESC',
				[repo.id],
			);

			return { session, repo: { ...repo, paths } };
		}).pipe(Effect.withSpan('repo.getSessionWithRepo')),

	getRepoPaths: (repoId: string) =>
		query<RepoPath>(
			'SELECT * FROM repo_paths WHERE repo_id = ? ORDER BY last_accessed_at DESC',
			[repoId],
		).pipe(Effect.withSpan('repo.getRepoPaths')),

	updateSessionBaseBranch: (sessionId: string, baseBranch: string | null) =>
		execute('UPDATE review_sessions SET base_branch = ? WHERE id = ?', [
			baseBranch,
			sessionId,
		]).pipe(
			Effect.map(() => undefined),
			Effect.withSpan('repo.updateSessionBaseBranch'),
		),
});

// Live layer
export const RepoServiceLive = Layer.succeed(RepoService, makeRepoService());
