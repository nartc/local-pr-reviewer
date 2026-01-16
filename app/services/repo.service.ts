import { generateId } from '../lib/effect-runtime';
import { getDatabase } from './db.service';
import { createGitService } from './git.service';

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

// Repo service - direct database access for use in loaders/actions
export const repoService = {
	// Get all repos with their paths
	getAllRepos: (): RepoWithPath[] => {
		const db = getDatabase();
		const repos = db
			.prepare('SELECT * FROM repos ORDER BY name')
			.all() as Repo[];

		return repos.map((repo) => {
			const paths = db
				.prepare(
					'SELECT * FROM repo_paths WHERE repo_id = ? ORDER BY last_accessed_at DESC',
				)
				.all(repo.id) as RepoPath[];
			return { ...repo, paths };
		});
	},

	// Get repo by ID
	getRepoById: (id: string): Repo | undefined => {
		const db = getDatabase();
		return db.prepare('SELECT * FROM repos WHERE id = ?').get(id) as
			| Repo
			| undefined;
	},

	// Get repo by remote URL
	getRepoByRemoteUrl: (remoteUrl: string): Repo | undefined => {
		const db = getDatabase();
		return db
			.prepare('SELECT * FROM repos WHERE remote_url = ?')
			.get(remoteUrl) as Repo | undefined;
	},

	// Get repo by path (looks up repo_paths then gets the repo)
	getRepoByPath: (path: string): Repo | undefined => {
		const db = getDatabase();
		const repoPath = db
			.prepare('SELECT * FROM repo_paths WHERE path = ?')
			.get(path) as RepoPath | undefined;
		if (!repoPath) return undefined;
		return db
			.prepare('SELECT * FROM repos WHERE id = ?')
			.get(repoPath.repo_id) as Repo | undefined;
	},

	// Create or get repo from a path
	createOrGetRepoFromPath: async (
		path: string,
	): Promise<{ repo: Repo; repoPath: RepoPath; isNew: boolean }> => {
		const db = getDatabase();
		const git = createGitService();

		// Check if path already registered
		const existingPath = db
			.prepare('SELECT * FROM repo_paths WHERE path = ?')
			.get(path) as RepoPath | undefined;
		if (existingPath) {
			const repo = db
				.prepare('SELECT * FROM repos WHERE id = ?')
				.get(existingPath.repo_id) as Repo;
			// Update last accessed
			db.prepare(
				"UPDATE repo_paths SET last_accessed_at = datetime('now') WHERE id = ?",
			).run(existingPath.id);
			return { repo, repoPath: existingPath, isNew: false };
		}

		// Get git info
		const remoteUrl = await git.getRemoteUrl(path);
		const repoName = path.split('/').pop() || 'unknown';

		// Check if repo with same remote exists
		let repo: Repo | undefined;
		if (remoteUrl) {
			repo = db
				.prepare('SELECT * FROM repos WHERE remote_url = ?')
				.get(remoteUrl) as Repo | undefined;
		}

		// Create repo if not exists
		if (!repo) {
			const repoId = generateId();
			const baseBranch = await git
				.getDefaultBranch(path)
				.catch(() => 'main');

			db.prepare(
				'INSERT INTO repos (id, remote_url, name, base_branch) VALUES (?, ?, ?, ?)',
			).run(repoId, remoteUrl, repoName, baseBranch);

			repo = db
				.prepare('SELECT * FROM repos WHERE id = ?')
				.get(repoId) as Repo;
		}

		// Create repo path
		const pathId = generateId();
		db.prepare(
			"INSERT INTO repo_paths (id, repo_id, path, last_accessed_at) VALUES (?, ?, ?, datetime('now'))",
		).run(pathId, repo.id, path);

		const repoPath = db
			.prepare('SELECT * FROM repo_paths WHERE id = ?')
			.get(pathId) as RepoPath;

		return { repo, repoPath, isNew: true };
	},

	// Delete repo and all associated data
	deleteRepo: (id: string): void => {
		const db = getDatabase();
		db.prepare('DELETE FROM repos WHERE id = ?').run(id);
	},

	// Delete a specific path (but keep repo if other paths exist)
	deleteRepoPath: (pathId: string): void => {
		const db = getDatabase();
		const repoPath = db
			.prepare('SELECT * FROM repo_paths WHERE id = ?')
			.get(pathId) as RepoPath | undefined;
		if (!repoPath) return;

		db.prepare('DELETE FROM repo_paths WHERE id = ?').run(pathId);

		// Check if repo has any other paths
		const otherPaths = db
			.prepare(
				'SELECT COUNT(*) as count FROM repo_paths WHERE repo_id = ?',
			)
			.get(repoPath.repo_id) as { count: number };
		if (otherPaths.count === 0) {
			// Delete repo if no paths left
			db.prepare('DELETE FROM repos WHERE id = ?').run(repoPath.repo_id);
		}
	},

	// Update repo base branch
	updateBaseBranch: (repoId: string, baseBranch: string): void => {
		const db = getDatabase();
		db.prepare('UPDATE repos SET base_branch = ? WHERE id = ?').run(
			baseBranch,
			repoId,
		);
	},

	// Session management
	getOrCreateSession: async (
		repoId: string,
		path: string,
	): Promise<ReviewSession> => {
		const db = getDatabase();
		const git = createGitService();

		const currentBranch = await git.getCurrentBranch(path);

		// Check for existing session
		const existing = db
			.prepare(
				'SELECT * FROM review_sessions WHERE repo_id = ? AND branch = ?',
			)
			.get(repoId, currentBranch) as ReviewSession | undefined;

		if (existing) return existing;

		// Create new session
		const sessionId = generateId();
		db.prepare(
			'INSERT INTO review_sessions (id, repo_id, branch) VALUES (?, ?, ?)',
		).run(sessionId, repoId, currentBranch);

		return db
			.prepare('SELECT * FROM review_sessions WHERE id = ?')
			.get(sessionId) as ReviewSession;
	},

	getSessionById: (id: string): ReviewSession | undefined => {
		const db = getDatabase();
		return db
			.prepare('SELECT * FROM review_sessions WHERE id = ?')
			.get(id) as ReviewSession | undefined;
	},

	// Get session with repo info
	getSessionWithRepo: (
		sessionId: string,
	): { session: ReviewSession; repo: RepoWithPath } | undefined => {
		const db = getDatabase();
		const session = db
			.prepare('SELECT * FROM review_sessions WHERE id = ?')
			.get(sessionId) as ReviewSession | undefined;
		if (!session) return undefined;

		const repo = db
			.prepare('SELECT * FROM repos WHERE id = ?')
			.get(session.repo_id) as Repo | undefined;
		if (!repo) return undefined;

		const paths = db
			.prepare(
				'SELECT * FROM repo_paths WHERE repo_id = ? ORDER BY last_accessed_at DESC',
			)
			.all(repo.id) as RepoPath[];

		return { session, repo: { ...repo, paths } };
	},

	// Get paths for a repo
	getRepoPaths: (repoId: string): RepoPath[] => {
		const db = getDatabase();
		return db
			.prepare(
				'SELECT * FROM repo_paths WHERE repo_id = ? ORDER BY last_accessed_at DESC',
			)
			.all(repoId) as RepoPath[];
	},

	// Update session base branch override
	updateSessionBaseBranch: (
		sessionId: string,
		baseBranch: string | null,
	): void => {
		const db = getDatabase();
		db.prepare(
			'UPDATE review_sessions SET base_branch = ? WHERE id = ?',
		).run(baseBranch, sessionId);
	},
};
