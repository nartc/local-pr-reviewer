import compression from 'compression';
import express from 'express';
import morgan from 'morgan';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Short-circuit the type-checking of the built output.
const BUILD_PATH = './build/server/index.js';
const DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * Get the config directory path
 */
function getConfigDir() {
	const xdgConfig = process.env.XDG_CONFIG_HOME;
	const configBase = xdgConfig || join(homedir(), '.config');
	return join(configBase, 'local-pr-reviewer');
}

/**
 * Get path to server.json
 */
function getServerJsonPath() {
	return join(getConfigDir(), 'server.json');
}

/**
 * Write server info to server.json
 * @param {number} port
 * @param {number} pid
 */
function writeServerInfo(port, pid) {
	const serverJsonPath = getServerJsonPath();
	const configDir = getConfigDir();

	// Ensure config dir exists
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}

	const info = {
		port,
		pid,
		startedAt: new Date().toISOString(),
	};

	writeFileSync(serverJsonPath, JSON.stringify(info, null, 2));
}

/**
 * Find an available port
 */
async function findAvailablePort(startPort = 3000) {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(startPort, '127.0.0.1', () => {
			const address = server.address();
			if (address && typeof address === 'object') {
				const port = address.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error('Could not get port')));
			}
		});
		server.on('error', () => {
			// Port is in use, try next one
			resolve(findAvailablePort(startPort + 1));
		});
	});
}

// Determine port - use PORT env var if set, otherwise find available
const getPort = async () => {
	if (process.env.PORT) {
		return Number.parseInt(process.env.PORT);
	}
	// In development, use 3000 for consistency
	if (DEVELOPMENT) {
		return 3000;
	}
	// In production, find an available port
	return findAvailablePort();
};

const app = express();

app.use(compression());
app.disable('x-powered-by');

if (DEVELOPMENT) {
	console.log('Starting development server');
	const viteDevServer = await import('vite').then((vite) =>
		vite.createServer({
			server: { middlewareMode: true },
		}),
	);
	app.use(viteDevServer.middlewares);
	app.use(async (req, res, next) => {
		try {
			const source = await viteDevServer.ssrLoadModule('./server/app.ts');
			return await source.app(req, res, next);
		} catch (error) {
			if (typeof error === 'object' && error instanceof Error) {
				viteDevServer.ssrFixStacktrace(error);
			}
			next(error);
		}
	});
} else {
	console.log('Starting production server');
	app.use(
		'/assets',
		express.static('build/client/assets', {
			immutable: true,
			maxAge: '1y',
		}),
	);
	app.use(morgan('combined'));
	app.use(express.static('build/client', { maxAge: '1h' }));
	app.use(await import(BUILD_PATH).then((mod) => mod.app));

	// Error handling middleware - must have 4 params for Express to recognize it
	app.use(
		/** @type {import('express').ErrorRequestHandler} */
		(err, _req, res, _next) => {
			console.error('=== SERVER ERROR ===');
			console.error('Message:', err.message);
			console.error('Stack:', err.stack);
			console.error('====================');
			if (!res.headersSent) {
				res.status(500).json({ error: err.message });
			}
		},
	);
}

const PORT = await getPort();

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);

	// Write server info for CLI/MCP tools to find
	// Only in production mode (CLI-managed)
	if (!DEVELOPMENT) {
		writeServerInfo(PORT, process.pid);
	}
});
