import { readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createGitService } from '../services/git.service';

// Config defaults match app/lib/config.ts
const MAX_DEPTH = parseInt(process.env.REPO_SCAN_MAX_DEPTH || '3', 10);
const SCAN_ROOT =
	process.env.REPO_SCAN_ROOT?.replace('~', homedir()) ||
	process.env.HOME ||
	'/';

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

interface GitRepo {
	path: string;
	name: string;
}

async function scanForRepos(
	dir: string,
	depth: number = 0,
): Promise<GitRepo[]> {
	if (depth > MAX_DEPTH) return [];

	const git = createGitService();
	const repos: GitRepo[] = [];

	try {
		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (IGNORED_DIRS.has(entry.name)) continue;
			if (entry.name.startsWith('.') && entry.name !== '.git') continue;

			const fullPath = join(dir, entry.name);

			// Check if this is a git repo
			const isRepo = await git.isGitRepo(fullPath);
			if (isRepo) {
				repos.push({
					path: fullPath,
					name: entry.name,
				});
				// Don't recurse into git repos
				continue;
			}

			// Recurse into subdirectories
			const subRepos = await scanForRepos(fullPath, depth + 1);
			repos.push(...subRepos);
		}
	} catch {
		// Ignore permission errors, etc.
	}

	return repos;
}

export async function loader() {
	try {
		const repos = await scanForRepos(SCAN_ROOT);
		// Sort by name
		repos.sort((a, b) => a.name.localeCompare(b.name));
		return Response.json({ repos });
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: 'Failed to scan repositories',
			},
			{ status: 500 },
		);
	}
}
