import { Effect, Stream } from 'effect';
import { Dirent, readdirSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '../lib/config';
import { runtime } from '../lib/effect-runtime';
import {
	type GitService as GitServiceType,
	GitService,
} from '../services/git.service';

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

export interface GitRepo {
	path: string;
	name: string;
}

/**
 * Stream-based repo scanner that yields repos as they're found
 */
const scanForReposStream = (
	git: GitServiceType,
	dir: string,
	maxDepth: number,
	depth: number = 0,
): Stream.Stream<GitRepo> =>
	Stream.suspend(() => {
		if (depth > maxDepth) return Stream.empty;

		let entries: Dirent[];
		try {
			entries = readdirSync(dir, {
				withFileTypes: true,
				encoding: 'utf-8',
			});
		} catch {
			// Ignore permission errors, etc.
			return Stream.empty;
		}

		return Stream.fromIterable(entries).pipe(
			Stream.filter(
				(entry) =>
					entry.isDirectory() &&
					!IGNORED_DIRS.has(entry.name) &&
					!(entry.name.startsWith('.') && entry.name !== '.git'),
			),
			Stream.mapEffect((entry) =>
				Effect.gen(function* () {
					const fullPath = join(dir, entry.name);
					const isRepo = yield* git.isGitRepo(fullPath);
					return { entry, fullPath, isRepo };
				}),
			),
			Stream.flatMap(
				({ entry, fullPath, isRepo }): Stream.Stream<GitRepo> => {
					if (isRepo) {
						return Stream.make({
							path: fullPath,
							name: entry.name,
						});
					}
					// Recurse into subdirectories
					return scanForReposStream(
						git,
						fullPath,
						maxDepth,
						depth + 1,
					);
				},
			),
		);
	});

export async function loader() {
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			try {
				await runtime.runPromise(
					Effect.gen(function* () {
						const git = yield* GitService;
						const { config } = yield* ConfigService;

						const repoStream = scanForReposStream(
							git,
							config.repoScanRoot,
							config.repoScanMaxDepth,
						);

						// Collect and sort for streaming (we still want alphabetical order)
						// But stream each one as it's added to maintain responsiveness
						const repos: GitRepo[] = [];

						yield* repoStream.pipe(
							Stream.runForEach((repo) =>
								Effect.sync(() => {
									repos.push(repo);
									// Sort incrementally and stream the current state
									repos.sort((a, b) =>
										a.name.localeCompare(b.name),
									);
									// Stream as NDJSON - each line is a complete JSON object
									controller.enqueue(
										encoder.encode(
											JSON.stringify({
												type: 'repo',
												data: repo,
											}) + '\n',
										),
									);
								}),
							),
						);

						// Signal completion
						controller.enqueue(
							encoder.encode(
								JSON.stringify({
									type: 'done',
									total: repos.length,
								}) + '\n',
							),
						);
					}).pipe(
						Effect.catchAll((error) =>
							Effect.sync(() => {
								controller.enqueue(
									encoder.encode(
										JSON.stringify({
											type: 'error',
											message:
												String(error) ||
												'Failed to scan repositories',
										}) + '\n',
									),
								);
							}),
						),
					),
				);
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-ndjson',
			'Transfer-Encoding': 'chunked',
			'Cache-Control': 'no-cache',
		},
	});
}
