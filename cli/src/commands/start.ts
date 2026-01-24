// Start command for local-pr-reviewer

import * as p from '@clack/prompts';
import color from 'picocolors';
import {
	getRunningServer,
	getServerUrl,
	startServer,
} from '../utils/process.js';

interface StartOptions {
	repo?: string;
}

export async function start(options: StartOptions = {}): Promise<void> {
	p.intro(color.bgCyan(color.black(' local-pr-reviewer ')));

	// Check if server is already running
	const existingServer = getRunningServer();

	if (existingServer) {
		const url = getServerUrl(existingServer, options.repo);
		p.log.success(`Server already running on port ${existingServer.port}`);
		p.outro(color.cyan(url));
		return;
	}

	// Start the server
	const s = p.spinner();
	s.start('Starting server');

	try {
		const serverInfo = await startServer();
		s.stop('Server started');

		const url = getServerUrl(serverInfo, options.repo);
		p.log.success(`Server running on port ${serverInfo.port}`);
		p.outro(color.cyan(url));
	} catch (error) {
		s.stop('Failed to start server');
		p.log.error(
			error instanceof Error ? error.message : 'Unknown error occurred',
		);
		p.outro(
			color.red(
				"Run 'npx local-pr-reviewer setup' if you haven't set up yet.",
			),
		);
		process.exit(1);
	}
}
