import { FileSystem, Path } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { Context, Effect, Layer, Stream } from 'effect';
import simpleGit, { type DiffResultTextFile, type SimpleGit } from 'simple-git';
import { GitError, NotAGitRepoError } from '../lib/errors';

/** Directories to skip when scanning for repos */
const IGNORED_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'.cache',
	'coverage',
	'vendor',
	'__pycache__',
	'.venv',
	'venv',
]);

/** Repository info returned from scanning */
export interface ScannedRepo {
	path: string;
	name: string;
}

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
	/**
	 * Scan directories for git repositories.
	 * Returns a stream that yields repos as they're found.
	 */
	readonly scanForRepos: (
		roots: string[],
		maxDepth: number,
	) => Stream.Stream<ScannedRepo>;
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

// Live implementation - depends on FileSystem and Path from @effect/platform
export const GitServiceLive = Layer.effect(
	GitService,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const scanDir = (
			dir: string,
			depth: number,
			maxDepth: number,
		): Stream.Stream<ScannedRepo> =>
			Stream.unwrap(
				Effect.gen(function* () {
					if (depth > maxDepth) return Stream.empty;

					const entries = yield* fs
						.readDirectory(dir)
						.pipe(
							Effect.catchAll(() =>
								Effect.succeed([] as string[]),
							),
						);

					// Filter to directories only (need to check each entry)
					const dirEntries: Array<{
						name: string;
						fullPath: string;
					}> = [];
					for (const name of entries) {
						if (IGNORED_DIRS.has(name)) continue;
						if (name.startsWith('.') && name !== '.git') continue;

						const fullPath = path.join(dir, name);
						const stat = yield* fs
							.stat(fullPath)
							.pipe(Effect.catchAll(() => Effect.succeed(null)));
						if (stat?.type === 'Directory') {
							dirEntries.push({ name, fullPath });
						}
					}

					return Stream.fromIterable(dirEntries).pipe(
						Stream.mapEffect(({ name, fullPath }) =>
							fs
								.exists(path.join(fullPath, '.git'))
								.pipe(
									Effect.catchAll(() =>
										Effect.succeed(false),
									),
								)
								.pipe(
									Effect.map((isRepo) => ({
										name,
										fullPath,
										isRepo,
									})),
								),
						),
						Stream.flatMap(({ name, fullPath, isRepo }) => {
							if (isRepo) {
								return Stream.make({ path: fullPath, name });
							}
							return scanDir(fullPath, depth + 1, maxDepth);
						}),
					);
				}),
			);

		return GitService.of({
			isGitRepo: (repoPath: string) =>
				Effect.tryPromise({
					try: async () => {
						const git = gitFor(repoPath);
						return await git.checkIsRepo();
					},
					catch: () => false as never,
				}).pipe(Effect.catchAll(() => Effect.succeed(false))),

			scanForRepos: (roots: string[], maxDepth: number) => {
				const rootStreams = roots.map((root) =>
					scanDir(root, 0, maxDepth),
				);
				return rootStreams.length > 0
					? Stream.mergeAll(rootStreams, {
							concurrency: rootStreams.length,
						})
					: Stream.empty;
			},

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
						const branch = await git.revparse([
							'--abbrev-ref',
							'HEAD',
						]);
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
							if (branches.all.includes('main')) return 'main';
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

			getInfo: (repoPath: string) =>
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
										const branches =
											await git.branchLocal();
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

					// Get diff summary (--no-ext-diff bypasses external diff tools like difft)
					const diffSummary = yield* Effect.tryPromise({
						try: () =>
							git.diffSummary(['--no-ext-diff', baseBranch]),
						catch: (error) =>
							new GitError({
								message: 'Failed to get diff summary',
								cause: error,
							}),
					});

					// Get raw diff for rendering
					const rawDiff = yield* Effect.tryPromise({
						try: () => git.diff(['--no-ext-diff', baseBranch]),
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
		});
	}),
).pipe(Layer.provide(NodeContext.layer));
