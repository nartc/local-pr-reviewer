// Stop command for local-pr-reviewer

import * as p from '@clack/prompts';
import color from 'picocolors';
import { getRunningServer, stopServer } from '../utils/process.js';

export async function stop(): Promise<void> {
	p.intro(color.bgCyan(color.black(' local-pr-reviewer ')));

	// Check if server is running
	const serverInfo = getRunningServer();

	if (!serverInfo) {
		p.log.warn('Server is not running');
		p.outro('Nothing to do.');
		return;
	}

	const s = p.spinner();
	s.start(`Stopping server (PID: ${serverInfo.pid})`);

	const stopped = stopServer();

	if (stopped) {
		s.stop('Server stopped');
		p.outro(color.green('Server stopped successfully.'));
	} else {
		s.stop('Failed to stop server');
		p.log.error(
			`Could not stop process ${serverInfo.pid}. It may have already exited.`,
		);
		p.outro(color.yellow('Server may already be stopped.'));
	}
}
