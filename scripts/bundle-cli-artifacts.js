#!/usr/bin/env node
// Script to bundle artifacts into cli/artifacts/ for npm publishing

import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const artifactsDir = join(rootDir, 'cli', 'artifacts');

console.log('Bundling CLI artifacts...');

// Clean artifacts directory
if (existsSync(artifactsDir)) {
	rmSync(artifactsDir, { recursive: true });
}
mkdirSync(artifactsDir, { recursive: true });

// Files and directories to copy
const items = [
	{ src: 'build', dest: 'build' },
	{ src: 'dist', dest: 'dist' },
	{ src: 'server.js', dest: 'server.js' },
	{ src: 'db/schema.sql', dest: 'db/schema.sql' },
];

for (const item of items) {
	const srcPath = join(rootDir, item.src);
	const destPath = join(artifactsDir, item.dest);

	if (!existsSync(srcPath)) {
		console.warn(`Warning: ${item.src} not found, skipping`);
		continue;
	}

	// Ensure destination directory exists
	const destDir = dirname(destPath);
	if (!existsSync(destDir)) {
		mkdirSync(destDir, { recursive: true });
	}

	cpSync(srcPath, destPath, { recursive: true });
	console.log(`  Copied ${item.src} -> cli/artifacts/${item.dest}`);
}

// Create a minimal package.json for the artifacts
const rootPkg = JSON.parse(
	readFileSync(join(rootDir, 'package.json'), 'utf-8'),
);

const artifactPkg = {
	name: 'local-pr-reviewer-server',
	version: rootPkg.version,
	type: 'module',
	dependencies: {
		// Only production dependencies needed to run
		'@ai-sdk/anthropic': rootPkg.dependencies['@ai-sdk/anthropic'],
		'@ai-sdk/google': rootPkg.dependencies['@ai-sdk/google'],
		'@ai-sdk/openai': rootPkg.dependencies['@ai-sdk/openai'],
		'@effect/platform': rootPkg.dependencies['@effect/platform'],
		'@effect/platform-node': rootPkg.dependencies['@effect/platform-node'],
		'@modelcontextprotocol/sdk':
			rootPkg.dependencies['@modelcontextprotocol/sdk'],
		'@pierre/diffs': rootPkg.dependencies['@pierre/diffs'],
		'@radix-ui/react-dialog':
			rootPkg.dependencies['@radix-ui/react-dialog'],
		'@radix-ui/react-dropdown-menu':
			rootPkg.dependencies['@radix-ui/react-dropdown-menu'],
		'@radix-ui/react-tooltip':
			rootPkg.dependencies['@radix-ui/react-tooltip'],
		'@radix-ui/themes': rootPkg.dependencies['@radix-ui/themes'],
		'@react-router/express': rootPkg.dependencies['@react-router/express'],
		'@react-router/node': rootPkg.dependencies['@react-router/node'],
		'@tanstack/react-virtual':
			rootPkg.dependencies['@tanstack/react-virtual'],
		ai: rootPkg.dependencies['ai'],
		'better-sqlite3': rootPkg.dependencies['better-sqlite3'],
		compression: rootPkg.dependencies['compression'],
		effect: rootPkg.dependencies['effect'],
		express: rootPkg.dependencies['express'],
		isbot: rootPkg.dependencies['isbot'],
		morgan: rootPkg.dependencies['morgan'],
		react: rootPkg.dependencies['react'],
		'react-dom': rootPkg.dependencies['react-dom'],
		'react-icons': rootPkg.dependencies['react-icons'],
		'react-router': rootPkg.dependencies['react-router'],
		'remix-utils': rootPkg.dependencies['remix-utils'],
		'simple-git': rootPkg.dependencies['simple-git'],
		sonner: rootPkg.dependencies['sonner'],
		zod: '^3.24.0',
	},
};

writeFileSync(
	join(artifactsDir, 'package.json'),
	JSON.stringify(artifactPkg, null, 2),
);
console.log('  Created cli/artifacts/package.json');

console.log('Done!');
