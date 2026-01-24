// API route for setting up signal file in a repository

import { NodeContext } from '@effect/platform-node';
import { Effect } from 'effect';
import {
	checkSignalFileStatus,
	createSignalFile,
} from '../lib/signal-file.server';
import type { Route } from './+types/api.setup-signal';

const signalRuntime = Effect.runPromise;

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

	const result = await signalRuntime(
		createSignalFile(repoPath, remember).pipe(
			Effect.provide(NodeContext.layer),
		),
	);

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

	const status = await signalRuntime(
		checkSignalFileStatus(repoPath).pipe(Effect.provide(NodeContext.layer)),
	);
	return Response.json(status);
}
