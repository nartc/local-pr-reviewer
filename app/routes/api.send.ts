import { Effect } from 'effect';
import { runtime } from '../lib/effect-runtime';
import { CommentService, type Comment } from '../services/comment.service';
import type { Route } from './+types/api.send';

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get('intent') as string;

	return runtime.runPromise(
		Effect.gen(function* () {
			const comments = yield* CommentService;

			switch (intent) {
				case 'send': {
					const commentIds = formData.getAll(
						'commentIds',
					) as string[];

					if (commentIds.length === 0) {
						return Response.json(
							{ error: 'No comments to send' },
							{ status: 400 },
						);
					}

					const commentResults = yield* Effect.all(
						commentIds.map((id) => comments.getComment(id)),
					);
					const validComments = commentResults.filter(
						(c): c is Comment => c !== undefined,
					);

					if (validComments.length === 0) {
						return Response.json(
							{ error: 'No valid comments found' },
							{ status: 404 },
						);
					}

					// Mark as sent - MCP agents will pick these up when they poll
					yield* comments.markAsSent(commentIds);

					return Response.json({
						success: true,
						count: validComments.length,
					});
				}

				default:
					return Response.json(
						{ error: 'Unknown action' },
						{ status: 400 },
					);
			}
		}).pipe(
			Effect.catchAll((error) =>
				Effect.succeed(
					Response.json(
						{
							error:
								error instanceof Error
									? error.message
									: 'Failed to send',
						},
						{ status: 500 },
					),
				),
			),
		),
	);
}
