import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Types
export interface TmuxSession {
	name: string;
	windowCount: number;
	attached: boolean;
	workingDir: string;
	detectedProcess: string | null;
}

export interface TmuxPane {
	sessionName: string;
	windowIndex: number;
	paneIndex: number;
	currentCommand: string;
	workingDir: string;
}

// Known coding agent processes
const CODING_AGENTS = ['claude', 'opencode', 'aider', 'cursor', 'copilot'];

// tmux service
export const tmuxService = {
	// Check if tmux is available
	isAvailable: (): boolean => {
		try {
			execSync('which tmux', { stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	},

	// List all tmux sessions
	listSessions: async (): Promise<TmuxSession[]> => {
		try {
			const { stdout } = await execAsync(
				'tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_attached}|#{pane_current_path}"',
			);

			const sessions: TmuxSession[] = [];

			for (const line of stdout.trim().split('\n')) {
				if (!line) continue;
				const [name, windowCount, attached, workingDir] =
					line.split('|');

				// Detect running process in the session
				const detectedProcess =
					await tmuxService.detectCodingAgent(name);

				sessions.push({
					name,
					windowCount: parseInt(windowCount, 10),
					attached: attached === '1',
					workingDir: workingDir || '',
					detectedProcess,
				});
			}

			return sessions;
		} catch {
			return [];
		}
	},

	// Detect if a coding agent is running in a session (checks all windows/panes)
	detectCodingAgent: async (sessionName: string): Promise<string | null> => {
		try {
			// Get commands from ALL panes across ALL windows in the session
			const { stdout } = await execAsync(
				`tmux list-panes -t "${sessionName}" -s -F "#{pane_current_command}" 2>/dev/null`,
			);

			const commands = stdout.trim().split('\n');

			for (const cmd of commands) {
				const lowerCmd = cmd.toLowerCase();
				for (const agent of CODING_AGENTS) {
					if (lowerCmd.includes(agent)) {
						return agent;
					}
				}
			}

			return null;
		} catch {
			return null;
		}
	},

	// Get sessions running coding agents
	getCodingAgentSessions: async (): Promise<TmuxSession[]> => {
		const sessions = await tmuxService.listSessions();
		return sessions.filter((s) => s.detectedProcess !== null);
	},

	// Send text to a tmux session via paste buffer
	sendToSession: async (sessionName: string, text: string): Promise<void> => {
		// Use load-buffer and paste-buffer for reliable text sending
		// This handles special characters and multi-line text properly

		try {
			// Load text into tmux buffer
			await execAsync(
				`tmux load-buffer -b pr-reviewer - <<'EOF'\n${text}\nEOF`,
			);

			// Paste buffer into the target session
			await execAsync(
				`tmux paste-buffer -b pr-reviewer -t "${sessionName}"`,
			);

			// Clean up the buffer
			await execAsync('tmux delete-buffer -b pr-reviewer');

			// Press Enter to submit
			await execAsync(`tmux send-keys -t "${sessionName}" Enter`);
		} catch (error) {
			// Fallback: use send-keys for simpler text
			const simpleText = text.replace(/"/g, '\\"').replace(/\n/g, '\\n');
			await execAsync(
				`tmux send-keys -t "${sessionName}" "${simpleText}" Enter`,
			);
		}
	},

	// Format comment for sending
	formatComment: (
		filePath: string,
		lineStart: number | null,
		content: string,
	): string => {
		const lineInfo = lineStart ? `:${lineStart}` : '';
		return `**${filePath}${lineInfo}**\n${content}`;
	},

	// Format multiple comments for batch sending
	formatComments: (
		comments: Array<{
			file_path: string;
			line_start: number | null;
			content: string;
		}>,
	): string => {
		return comments
			.map((c) =>
				tmuxService.formatComment(c.file_path, c.line_start, c.content),
			)
			.join('\n\n---\n\n');
	},

	// Send a single comment to a session
	sendComment: async (
		sessionName: string,
		filePath: string,
		lineStart: number | null,
		content: string,
	): Promise<void> => {
		const formatted = tmuxService.formatComment(
			filePath,
			lineStart,
			content,
		);
		await tmuxService.sendToSession(sessionName, formatted);
	},

	// Send multiple comments to a session
	sendComments: async (
		sessionName: string,
		comments: Array<{
			file_path: string;
			line_start: number | null;
			content: string;
		}>,
	): Promise<void> => {
		const formatted = tmuxService.formatComments(comments);
		await tmuxService.sendToSession(sessionName, formatted);
	},
};
