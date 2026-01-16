import {
	Badge,
	DropdownMenu,
	IconButton,
	Text,
	Tooltip,
} from '@radix-ui/themes';
import { useCallback, useEffect, useId, useState } from 'react';
import {
	VscBeaker,
	VscRefresh,
	VscTerminal,
	VscWarning,
} from 'react-icons/vsc';
import { useAsyncState } from '../lib/async-state';
import { useAsyncAction } from '../lib/use-async-action';
import type { TmuxSession, TmuxWindow } from '../services/tmux.service';

interface SessionSelectorProps {
	selectedSession: string | null;
	onSelectSession: (sessionName: string) => void;
	repoPath?: string;
}

export function SessionSelector({
	selectedSession,
	onSelectSession,
	repoPath,
}: SessionSelectorProps) {
	const [sessions, setSessions] = useState<TmuxSession[]>([]);
	const [codingAgentSessions, setCodingAgentSessions] = useState<
		TmuxSession[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [available, setAvailable] = useState(true);
	const { startOperation, endOperation } = useAsyncState();
	const operationId = useId();

	const fetchSessions = useCallback(async () => {
		setLoading(true);
		startOperation(operationId);
		try {
			const res = await fetch('/api/sessions');
			const data = await res.json();
			setAvailable(data.available);

			let allSessions: TmuxSession[] = data.sessions || [];
			let agentSessions: TmuxSession[] = data.codingAgentSessions || [];

			// Filter sessions by repo path if provided
			if (repoPath) {
				const normalizedRepoPath = repoPath.replace(/\/$/, '');

				const windowMatchesPath = (w: TmuxWindow) =>
					w.paneCurrentPath.replace(/\/$/, '') ===
						normalizedRepoPath ||
					w.paneCurrentPath
						.replace(/\/$/, '')
						.startsWith(normalizedRepoPath + '/');

				const filterAndRecalculate = (
					sessions: TmuxSession[],
				): TmuxSession[] =>
					sessions
						.map((s) => {
							const matchingWindows =
								s.windows?.filter(windowMatchesPath) || [];
							const sessionDirMatches =
								s.workingDir.replace(/\/$/, '') ===
									normalizedRepoPath ||
								s.workingDir
									.replace(/\/$/, '')
									.startsWith(normalizedRepoPath + '/');

							if (
								matchingWindows.length === 0 &&
								!sessionDirMatches
							) {
								return null;
							}

							const agentWindowsInPath = matchingWindows.filter(
								(w) => w.detectedAgent !== null,
							);

							const CODING_AGENTS = [
								'claude',
								'opencode',
								'aider',
								'cursor',
								'copilot',
								'gemini',
								'codex',
							];
							agentWindowsInPath.sort((a, b) => {
								const aIdx = CODING_AGENTS.indexOf(
									a.detectedAgent!,
								);
								const bIdx = CODING_AGENTS.indexOf(
									b.detectedAgent!,
								);
								return aIdx - bIdx;
							});

							const detectedProcess =
								agentWindowsInPath.length > 0
									? agentWindowsInPath[0].detectedAgent
									: null;
							const multipleAgents =
								agentWindowsInPath.length > 1;

							return { ...s, detectedProcess, multipleAgents };
						})
						.filter((s): s is TmuxSession => s !== null);

				allSessions = filterAndRecalculate(allSessions);
				agentSessions = allSessions.filter(
					(s) => s.detectedProcess !== null,
				);
			}

			setSessions(allSessions);
			setCodingAgentSessions(agentSessions);

			if (!selectedSession) {
				const hasMultipleAgents = agentSessions.some(
					(s) => s.multipleAgents,
				);
				if (agentSessions.length > 0 && !hasMultipleAgents) {
					onSelectSession(agentSessions[0].name);
				} else if (
					allSessions.length > 0 &&
					agentSessions.length === 0
				) {
					onSelectSession(allSessions[0].name);
				}
			}
		} catch (error) {
			console.error('Failed to fetch sessions:', error);
			setAvailable(false);
		}
		setLoading(false);
		endOperation(operationId);
	}, [
		repoPath,
		selectedSession,
		onSelectSession,
		operationId,
		startOperation,
		endOperation,
	]);

	useEffect(() => {
		fetchSessions();
		const interval = setInterval(fetchSessions, 30000);
		return () => clearInterval(interval);
	}, [fetchSessions]);

	const selectedSessionData = sessions.find(
		(s) => s.name === selectedSession,
	);

	const { submit: sendTest, isPending: testPending } = useAsyncAction({
		successMessage: 'Test message sent!',
		errorMessage: 'Failed to send test message',
	});

	const handleTestSession = () => {
		if (!selectedSession) return;

		const formData = new FormData();
		formData.append('intent', 'test');
		formData.append('sessionName', selectedSession);

		sendTest(formData, { method: 'POST', action: '/api/sessions' });
	};

	if (!available) {
		return (
			<div className="flex items-center gap-2 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded">
				<VscWarning aria-hidden="true" />
				<Text size="2">tmux not available</Text>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<button
						className={`flex items-center gap-2 px-3 py-2 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-[200px] ${
							selectedSessionData?.multipleAgents
								? 'border-amber-500 ring-2 ring-amber-500/50'
								: 'border-gray-300 dark:border-gray-600'
						}`}
						disabled={loading}
						aria-label={
							loading
								? 'Loading sessions'
								: selectedSessionData
									? `Selected session: ${selectedSessionData.name}`
									: 'Select a tmux session'
						}
					>
						<VscTerminal
							className="w-4 h-4 text-gray-400"
							aria-hidden="true"
						/>
						<span className="flex-1 text-left truncate">
							{loading
								? 'Loading...'
								: selectedSessionData
									? selectedSessionData.name
									: 'Select session'}
						</span>
						{selectedSessionData?.multipleAgents && (
							<Badge color="amber" size="1">
								Multiple agents
							</Badge>
						)}
						{selectedSessionData?.detectedProcess &&
							!selectedSessionData?.multipleAgents && (
								<Badge color="green" size="1">
									{selectedSessionData.detectedProcess}
								</Badge>
							)}
					</button>
				</DropdownMenu.Trigger>

				<DropdownMenu.Content align="start" sideOffset={5}>
					{codingAgentSessions.length > 0 && (
						<>
							<DropdownMenu.Label>
								Coding Agents
							</DropdownMenu.Label>
							{codingAgentSessions.map((session) => (
								<DropdownMenu.Item
									key={session.name}
									onSelect={() =>
										onSelectSession(session.name)
									}
								>
									<div className="flex items-center justify-between w-full gap-2">
										<div className="min-w-0">
											<Text
												size="2"
												weight="medium"
												className="truncate block"
											>
												{session.name}
											</Text>
											<Text
												size="1"
												color="gray"
												className="truncate block"
											>
												{session.workingDir}
											</Text>
										</div>
										<Badge color="green" size="1">
											{session.detectedProcess}
										</Badge>
									</div>
								</DropdownMenu.Item>
							))}
							<DropdownMenu.Separator />
						</>
					)}

					<DropdownMenu.Label>All Sessions</DropdownMenu.Label>
					{sessions.length === 0 ? (
						<Text size="2" color="gray" className="px-2 py-2">
							No sessions found
						</Text>
					) : (
						sessions
							.filter((s) => !s.detectedProcess)
							.map((session) => (
								<DropdownMenu.Item
									key={session.name}
									onSelect={() =>
										onSelectSession(session.name)
									}
								>
									<div className="min-w-0">
										<Text
											size="2"
											weight="medium"
											className="truncate block"
										>
											{session.name}
										</Text>
										<Text
											size="1"
											color="gray"
											className="truncate block"
										>
											{session.workingDir}
										</Text>
									</div>
								</DropdownMenu.Item>
							))
					)}
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<Tooltip content="Refresh sessions">
				<IconButton
					variant="ghost"
					size="1"
					onClick={fetchSessions}
					disabled={loading}
					aria-label="Refresh sessions"
				>
					<VscRefresh
						className={loading ? 'animate-spin' : ''}
						aria-hidden="true"
					/>
				</IconButton>
			</Tooltip>

			<Tooltip content="Send test message to session">
				<IconButton
					variant="ghost"
					size="1"
					color="amber"
					onClick={handleTestSession}
					disabled={!selectedSession || testPending}
					aria-label="Test session"
				>
					<VscBeaker
						className={testPending ? 'animate-pulse' : ''}
						aria-hidden="true"
					/>
				</IconButton>
			</Tooltip>
		</div>
	);
}
