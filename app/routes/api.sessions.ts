import { tmuxService } from '../services/tmux.service';

export async function loader() {
	const isAvailable = tmuxService.isAvailable();

	if (!isAvailable) {
		return Response.json({
			available: false,
			sessions: [],
			error: 'tmux is not installed or not available',
		});
	}

	const sessions = await tmuxService.listSessions();
	const codingAgentSessions = sessions.filter(
		(s) => s.detectedProcess !== null,
	);

	return Response.json({
		available: true,
		sessions,
		codingAgentSessions,
	});
}
