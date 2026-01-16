import { Context, Effect, Layer } from 'effect';
import simpleGit, { type DiffResultTextFile, type SimpleGit } from 'simple-git';
import { GitError, NotAGitRepoError } from '../lib/errors';

// Types
export interface GitInfo {
	remoteUrl: string | null;
	currentBranch: string;
	baseBranch: string;
}

export interface DiffFile {
	path: string;
	status: 'added' | 'modified' | 'deleted' | 'renamed';
	additions: number;
	deletions: number;
	oldPath?: string;
}

export interface DiffResult {
	files: DiffFile[];
	rawDiff: string;
}

// Git service interface
export interface GitService {
	readonly getInfo: (
		repoPath: string,
	) => Effect.Effect<GitInfo, GitError | NotAGitRepoError>;
	readonly getDiff: (
		repoPath: string,
		baseBranch: string,
	) => Effect.Effect<DiffResult, GitError | NotAGitRepoError>;
	readonly isGitRepo: (path: string) => Effect.Effect<boolean, never>;
	readonly getRemoteUrl: (
		repoPath: string,
	) => Effect.Effect<string | null, GitError>;
	readonly getCurrentBranch: (
		repoPath: string,
	) => Effect.Effect<string, GitError>;
	readonly getDefaultBranch: (
		repoPath: string,
	) => Effect.Effect<string, GitError>;
}

export const GitService = Context.GenericTag<GitService>('GitService');

// Helper to create git instance for a path
const gitFor = (path: string): SimpleGit => simpleGit(path);

// Parse diff status to our type
const parseStatus = (
	status: string,
): 'added' | 'modified' | 'deleted' | 'renamed' => {
	switch (status) {
		case 'A':
			return 'added';
		case 'D':
			return 'deleted';
		case 'R':
			return 'renamed';
		default:
			return 'modified';
	}
};

// Live implementation
export const GitServiceLive = Layer.succeed(
	GitService,
	GitService.of({
		isGitRepo: (path: string) =>
			Effect.tryPromise({
				try: async () => {
					const git = gitFor(path);
					return await git.checkIsRepo();
				},
				catch: () => false as never,
			}).pipe(Effect.catchAll(() => Effect.succeed(false))),

		getRemoteUrl: (repoPath: string) =>
			Effect.tryPromise({
				try: async () => {
					const git = gitFor(repoPath);
					const remotes = await git.getRemotes(true);
					const origin = remotes.find((r) => r.name === 'origin');
					return origin?.refs?.fetch || null;
				},
				catch: (error) =>
					new GitError({
						message: 'Failed to get remote URL',
						cause: error,
					}),
			}),

		getCurrentBranch: (repoPath: string) =>
			Effect.tryPromise({
				try: async () => {
					const git = gitFor(repoPath);
					const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
					return branch.trim();
				},
				catch: (error) =>
					new GitError({
						message: 'Failed to get current branch',
						cause: error,
					}),
			}),

		getDefaultBranch: (repoPath: string) =>
			Effect.tryPromise({
				try: async () => {
					const git = gitFor(repoPath);
					// Try to get default branch from remote
					try {
						const result = await git.raw([
							'symbolic-ref',
							'refs/remotes/origin/HEAD',
						]);
						const match = result.match(
							/refs\/remotes\/origin\/(.+)/,
						);
						if (match) return match[1].trim();
					} catch {
						// Fallback: check if main or master exists
						const branches = await git.branchLocal();
						if (branches.all.includes('main')) return 'main';
						if (branches.all.includes('master')) return 'master';
					}
					return 'main'; // Default fallback
				},
				catch: (error) =>
					new GitError({
						message: 'Failed to get default branch',
						cause: error,
					}),
			}),

		getInfo: (repoPath: string) =>
			Effect.gen(function* () {
				const git = gitFor(repoPath);

				const isRepo = yield* Effect.tryPromise({
					try: () => git.checkIsRepo(),
					catch: () =>
						new NotAGitRepoError({
							path: repoPath,
						}),
				});

				if (!isRepo) {
					return yield* Effect.fail(
						new NotAGitRepoError({ path: repoPath }),
					);
				}

				const [remoteUrl, currentBranch, baseBranch] =
					yield* Effect.all([
						Effect.tryPromise({
							try: async () => {
								const remotes = await git.getRemotes(true);
								const origin = remotes.find(
									(r) => r.name === 'origin',
								);
								return origin?.refs?.fetch || null;
							},
							catch: (error) =>
								new GitError({
									message: 'Failed to get remote',
									cause: error,
								}),
						}),
						Effect.tryPromise({
							try: async () => {
								const branch = await git.revparse([
									'--abbrev-ref',
									'HEAD',
								]);
								return branch.trim();
							},
							catch: (error) =>
								new GitError({
									message: 'Failed to get branch',
									cause: error,
								}),
						}),
						Effect.tryPromise({
							try: async () => {
								try {
									const result = await git.raw([
										'symbolic-ref',
										'refs/remotes/origin/HEAD',
									]);
									const match = result.match(
										/refs\/remotes\/origin\/(.+)/,
									);
									if (match) return match[1].trim();
								} catch {
									const branches = await git.branchLocal();
									if (branches.all.includes('main'))
										return 'main';
									if (branches.all.includes('master'))
										return 'master';
								}
								return 'main';
							},
							catch: (error) =>
								new GitError({
									message: 'Failed to get default branch',
									cause: error,
								}),
						}),
					]);

				return { remoteUrl, currentBranch, baseBranch };
			}),

		getDiff: (repoPath: string, baseBranch: string) =>
			Effect.gen(function* () {
				const git = gitFor(repoPath);

				const isRepo = yield* Effect.tryPromise({
					try: () => git.checkIsRepo(),
					catch: () => new NotAGitRepoError({ path: repoPath }),
				});

				if (!isRepo) {
					return yield* Effect.fail(
						new NotAGitRepoError({ path: repoPath }),
					);
				}

				// Get diff summary
				const diffSummary = yield* Effect.tryPromise({
					try: () => git.diffSummary([baseBranch]),
					catch: (error) =>
						new GitError({
							message: 'Failed to get diff summary',
							cause: error,
						}),
				});

				// Get raw diff for rendering
				const rawDiff = yield* Effect.tryPromise({
					try: () => git.diff([baseBranch]),
					catch: (error) =>
						new GitError({
							message: 'Failed to get raw diff',
							cause: error,
						}),
				});

				const files: DiffFile[] = diffSummary.files.map((file) => {
					const textFile = file as DiffResultTextFile;
					const isBinary = !('insertions' in file);
					return {
						path: file.file,
						status: parseStatus(
							isBinary
								? 'M'
								: textFile.insertions > 0 &&
									  textFile.deletions === 0
									? 'A'
									: textFile.deletions > 0 &&
										  textFile.insertions === 0
										? 'D'
										: 'M',
						),
						additions: isBinary ? 0 : textFile.insertions,
						deletions: isBinary ? 0 : textFile.deletions,
					};
				});

				return { files, rawDiff };
			}),
	}),
);

// Direct helper for use outside Effect context
export const createGitService = () => {
	return {
		isGitRepo: async (path: string): Promise<boolean> => {
			try {
				return await gitFor(path).checkIsRepo();
			} catch {
				return false;
			}
		},
		getRemoteUrl: async (path: string): Promise<string | null> => {
			const git = gitFor(path);
			const remotes = await git.getRemotes(true);
			const origin = remotes.find((r) => r.name === 'origin');
			return origin?.refs?.fetch || null;
		},
		getCurrentBranch: async (path: string): Promise<string> => {
			const git = gitFor(path);
			const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
			return branch.trim();
		},
		getDefaultBranch: async (path: string): Promise<string> => {
			const git = gitFor(path);
			try {
				// Try to get default branch from remote
				const result = await git.raw([
					'symbolic-ref',
					'refs/remotes/origin/HEAD',
				]);
				const match = result.match(/refs\/remotes\/origin\/(.+)/);
				if (match) return match[1].trim();
			} catch {
				// Fallback: check if main or master exists
				const branches = await git.branchLocal();
				if (branches.all.includes('main')) return 'main';
				if (branches.all.includes('master')) return 'master';
			}
			return 'main'; // Default fallback
		},
		getDiff: async (path: string, baseBranch: string): Promise<string> => {
			const git = gitFor(path);
			// Use three-dot syntax to get commits on HEAD not in baseBranch
			// Plus include any uncommitted changes
			const committedDiff = await git.diff([`${baseBranch}...HEAD`]);
			const uncommittedDiff = await git.diff(['HEAD']);

			// Combine both diffs (committed changes from branch + uncommitted working changes)
			if (committedDiff && uncommittedDiff) {
				return committedDiff + uncommittedDiff;
			}
			return committedDiff || uncommittedDiff;
		},
		getDiffSummary: async (path: string, baseBranch: string) => {
			const git = gitFor(path);
			// Get summary of commits on HEAD not in baseBranch
			const committedSummary = await git.diffSummary([
				`${baseBranch}...HEAD`,
			]);
			const uncommittedSummary = await git.diffSummary(['HEAD']);

			// Merge the summaries
			const fileMap = new Map<
				string,
				(typeof committedSummary.files)[0]
			>();

			for (const file of committedSummary.files) {
				fileMap.set(file.file, file);
			}

			for (const file of uncommittedSummary.files) {
				const existing = fileMap.get(file.file);
				if (
					existing &&
					'insertions' in existing &&
					'insertions' in file
				) {
					// Merge stats for same file
					fileMap.set(file.file, {
						...existing,
						insertions: existing.insertions + file.insertions,
						deletions: existing.deletions + file.deletions,
						changes: existing.changes + file.changes,
					});
				} else {
					fileMap.set(file.file, file);
				}
			}

			return {
				...committedSummary,
				files: Array.from(fileMap.values()),
				insertions:
					committedSummary.insertions + uncommittedSummary.insertions,
				deletions:
					committedSummary.deletions + uncommittedSummary.deletions,
				changed: fileMap.size,
			};
		},
	};
};
