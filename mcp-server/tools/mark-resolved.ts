// Tool: mark_comment_resolved
// Marks a PR review comment as resolved

import { Effect } from 'effect';
import {
	CommentNotFoundError,
	DatabaseError,
	DbService,
} from '../shared/db.js';
import type { Comment } from '../shared/types.js';

interface MarkResolvedArgs {
	comment_id: string;
}

// Schema now defined in index.ts with Zod

export const markResolved = (
	args: MarkResolvedArgs,
): Effect.Effect<string, CommentNotFoundError | DatabaseError, DbService> =>
	Effect.gen(function* () {
		const db = yield* DbService;
		const { comment_id } = args;

		yield* Effect.logDebug('Marking comment as resolved', { comment_id });

		// Verify comment exists
		const comment = yield* db.queryOne<Comment>(
			'SELECT * FROM comments WHERE id = ?',
			[comment_id],
		);

		if (!comment) {
			return yield* Effect.fail(
				new CommentNotFoundError({ id: comment_id }),
			);
		}

		// Check if already resolved
		if (comment.resolved_at) {
			yield* Effect.logInfo('Comment already resolved', {
				comment_id,
				resolved_at: comment.resolved_at,
			});
			return `Comment ${comment_id} is already resolved (resolved at ${comment.resolved_at})`;
		}

		// Mark as resolved - update both status and resolved_at
		yield* db.execute(
			`UPDATE comments 
			 SET status = 'resolved', resolved_at = datetime('now'), resolved_by = 'agent'
			 WHERE id = ?`,
			[comment_id],
		);

		yield* Effect.logInfo('Comment marked as resolved', { comment_id });

		return `Comment ${comment_id} marked as resolved.`;
	}).pipe(Effect.withSpan('tool.markResolved'));
