// API route for setting up signal file in a repository

import {
	checkSignalFileStatus,
	createSignalFile,
} from '../lib/signal-file.server';
import type { Route } from './+types/api.setup-signal';

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const repoPath = formData.get('repoPath') as string;
	const remember = formData.get('remember') === 'true';

	if (!repoPath) {
		return Response.json(
			{ success: false, error: 'repoPath is required' },
			{ status: 400 },
		);
	}

	const result = createSignalFile(repoPath, remember);

	if (!result.success) {
		return Response.json(
			{ success: false, error: result.error },
			{ status: 500 },
		);
	}

	return Response.json({
		success: true,
		warning: result.warning,
		signalPath: result.signalPath,
	});
}

// Loader to check status
export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const repoPath = url.searchParams.get('repoPath');

	if (!repoPath) {
		return Response.json(
			{ error: 'repoPath query param is required' },
			{ status: 400 },
		);
	}

	const status = checkSignalFileStatus(repoPath);
	return Response.json(status);
}
