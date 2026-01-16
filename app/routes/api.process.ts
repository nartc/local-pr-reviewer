import { aiService } from '../services/ai.service';
import { commentService } from '../services/comment.service';
import type { Route } from './+types/api.process';

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get('intent') as string;

	try {
		switch (intent) {
			case 'process': {
				const commentIds = formData.getAll('commentIds') as string[];

				if (commentIds.length === 0) {
					return Response.json(
						{ error: 'No comments provided' },
						{ status: 400 },
					);
				}

				// Get comments
				const comments = commentIds
					.map((id) => commentService.getComment(id))
					.filter((c): c is NonNullable<typeof c> => c !== undefined);

				if (comments.length === 0) {
					return Response.json(
						{ error: 'No valid comments found' },
						{ status: 404 },
					);
				}

				// Process with AI
				const processedText = await aiService.processComments(comments);

				return Response.json({
					success: true,
					processedText,
					originalComments: comments,
				});
			}

			case 'saveSettings': {
				const provider = formData.get('provider') as
					| 'google'
					| 'openai'
					| 'anthropic';
				const model = formData.get('model') as string;

				if (!provider || !model) {
					return Response.json(
						{ error: 'Provider and model required' },
						{ status: 400 },
					);
				}

				aiService.saveSettings(provider, model);
				return Response.json({ success: true });
			}

			default:
				return Response.json(
					{ error: 'Unknown action' },
					{ status: 400 },
				);
		}
	} catch (error) {
		console.error('AI processing error:', error);
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: 'AI processing failed',
			},
			{ status: 500 },
		);
	}
}

export async function loader() {
	const availableProviders = aiService.getAvailableProviders();
	const settings = aiService.getSettings();

	const providerModels: Record<string, string[]> = {};
	for (const provider of availableProviders) {
		providerModels[provider] = aiService.getModelsForProvider(provider);
	}

	return Response.json({
		availableProviders,
		providerModels,
		currentSettings: settings,
	});
}
