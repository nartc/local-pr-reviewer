import {
	commentService,
	type CommentStatus,
} from '../services/comment.service';
import type { Route } from './+types/api.comments';

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get('intent') as string;

	try {
		switch (intent) {
			case 'create': {
				const sessionId = formData.get('sessionId') as string;
				const filePath = formData.get('filePath') as string;
				const content = formData.get('content') as string;
				const lineStart = formData.get('lineStart');
				const lineEnd = formData.get('lineEnd');
				const side = formData.get('side') as
					| 'old'
					| 'new'
					| 'both'
					| null;

				if (!sessionId || !filePath || !content) {
					return Response.json(
						{ error: 'Missing required fields' },
						{ status: 400 },
					);
				}

				const comment = commentService.createComment({
					sessionId,
					filePath,
					content,
					lineStart: lineStart
						? parseInt(lineStart as string, 10)
						: undefined,
					lineEnd: lineEnd
						? parseInt(lineEnd as string, 10)
						: undefined,
					side: side || undefined,
				});

				return Response.json({ comment });
			}

			case 'update': {
				const id = formData.get('id') as string;
				const content = formData.get('content') as string | null;
				const status = formData.get('status') as CommentStatus | null;

				if (!id) {
					return Response.json(
						{ error: 'Comment ID required' },
						{ status: 400 },
					);
				}

				const comment = commentService.updateComment(id, {
					content: content || undefined,
					status: status || undefined,
				});

				if (!comment) {
					return Response.json(
						{ error: 'Comment not found' },
						{ status: 404 },
					);
				}

				return Response.json({ comment });
			}

			case 'delete': {
				const id = formData.get('id') as string;

				if (!id) {
					return Response.json(
						{ error: 'Comment ID required' },
						{ status: 400 },
					);
				}

				const deleted = commentService.deleteComment(id);
				if (!deleted) {
					return Response.json(
						{ error: 'Comment not found' },
						{ status: 404 },
					);
				}

				return Response.json({ success: true });
			}

			case 'stage': {
				const ids = formData.getAll('ids') as string[];

				if (ids.length === 0) {
					return Response.json(
						{ error: 'No comment IDs provided' },
						{ status: 400 },
					);
				}

				const count = commentService.stageComments(ids);
				return Response.json({ success: true, count });
			}

			case 'markSent': {
				const ids = formData.getAll('ids') as string[];

				if (ids.length === 0) {
					return Response.json(
						{ error: 'No comment IDs provided' },
						{ status: 400 },
					);
				}

				const count = commentService.markAsSent(ids);
				return Response.json({ success: true, count });
			}

			default:
				return Response.json(
					{ error: 'Unknown action' },
					{ status: 400 },
				);
		}
	} catch (error) {
		console.error('Comment action error:', error);
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 },
		);
	}
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const sessionId = url.searchParams.get('sessionId');
	const status = url.searchParams.get('status') as CommentStatus | null;

	if (!sessionId) {
		return Response.json({ error: 'Session ID required' }, { status: 400 });
	}

	const comments = status
		? commentService.getCommentsByStatus(sessionId, status)
		: commentService.getSessionComments(sessionId);

	const counts = commentService.getCommentCounts(sessionId);

	return Response.json({ comments, counts });
}
