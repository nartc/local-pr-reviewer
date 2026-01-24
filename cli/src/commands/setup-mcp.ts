// Setup MCP command for local-pr-reviewer

import * as p from '@clack/prompts';
import color from 'picocolors';
import {
	configureMcp,
	isClaudeCodeConfigured,
	isOpenCodeConfigured,
	type CodingAgent,
} from '../utils/mcp-config.js';

export async function setupMcp(): Promise<void> {
	p.intro(color.bgCyan(color.black(' local-pr-reviewer setup-mcp ')));

	// Show current status
	const claudeConfigured = isClaudeCodeConfigured();
	const openCodeConfigured = isOpenCodeConfigured();

	if (claudeConfigured || openCodeConfigured) {
		p.log.info('Current MCP configuration:');
		if (claudeConfigured) {
			p.log.step(`  ${color.green('✓')} Claude Code`);
		}
		if (openCodeConfigured) {
			p.log.step(`  ${color.green('✓')} OpenCode`);
		}
	}

	// Ask which agents to configure
	const agentsResult = await p.multiselect({
		message: 'Which coding agents do you want to configure?',
		options: [
			{
				value: 'claude-code',
				label: 'Claude Code',
				hint: claudeConfigured ? 'already configured' : undefined,
			},
			{
				value: 'opencode',
				label: 'OpenCode',
				hint: openCodeConfigured ? 'already configured' : undefined,
			},
		],
		required: true,
	});

	if (p.isCancel(agentsResult)) {
		p.cancel('Setup cancelled.');
		process.exit(0);
	}

	const agents = agentsResult as CodingAgent[];

	// Configure MCP for each agent
	const s = p.spinner();

	for (const agent of agents) {
		s.start(`Configuring MCP for ${agent}`);
		const result = configureMcp(agent);

		if (result.success) {
			s.stop(`MCP configured for ${agent}`);
			p.log.success(`Updated: ${result.path}`);
		} else {
			s.stop(`Failed to configure MCP for ${agent}`);
			p.log.error(`Could not write to ${result.path}`);
		}
	}

	p.outro(color.green('MCP configuration complete!'));

	p.note(
		'Restart your coding agent for changes to take effect.',
		'Important',
	);
}
