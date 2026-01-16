import { generateId } from '../lib/effect-runtime';
import { getDatabase } from './db.service';

// Types
export type CommentStatus = 'queued' | 'staged' | 'sent' | 'cancelled';
export type CommentSide = 'old' | 'new' | 'both';

export interface Comment {
	id: string;
	session_id: string;
	file_path: string;
	line_start: number | null;
	line_end: number | null;
	side: CommentSide | null;
	content: string;
	status: CommentStatus;
	created_at: string;
	sent_at: string | null;
}

export interface CreateCommentInput {
	sessionId: string;
	filePath: string;
	lineStart?: number;
	lineEnd?: number;
	side?: CommentSide;
	content: string;
}

export interface UpdateCommentInput {
	content?: string;
	status?: CommentStatus;
}

// Comment service
export const commentService = {
	// Get all comments for a session
	getSessionComments: (sessionId: string): Comment[] => {
		const db = getDatabase();
		return db
			.prepare(
				'SELECT * FROM comments WHERE session_id = ? ORDER BY file_path, line_start',
			)
			.all(sessionId) as Comment[];
	},

	// Get comments by status
	getCommentsByStatus: (
		sessionId: string,
		status: CommentStatus,
	): Comment[] => {
		const db = getDatabase();
		return db
			.prepare(
				'SELECT * FROM comments WHERE session_id = ? AND status = ? ORDER BY file_path, line_start',
			)
			.all(sessionId, status) as Comment[];
	},

	// Get queued comments
	getQueuedComments: (sessionId: string): Comment[] => {
		return commentService.getCommentsByStatus(sessionId, 'queued');
	},

	// Get staged comments
	getStagedComments: (sessionId: string): Comment[] => {
		return commentService.getCommentsByStatus(sessionId, 'staged');
	},

	// Get sent comments
	getSentComments: (sessionId: string): Comment[] => {
		const db = getDatabase();
		return db
			.prepare(
				"SELECT * FROM comments WHERE session_id = ? AND status = 'sent' ORDER BY sent_at DESC",
			)
			.all(sessionId) as Comment[];
	},

	// Get a single comment
	getComment: (id: string): Comment | undefined => {
		const db = getDatabase();
		return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as
			| Comment
			| undefined;
	},

	// Create a new comment
	createComment: (input: CreateCommentInput): Comment => {
		const db = getDatabase();
		const id = generateId();

		db.prepare(
			`
      INSERT INTO comments (id, session_id, file_path, line_start, line_end, side, content, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued')
    `,
		).run(
			id,
			input.sessionId,
			input.filePath,
			input.lineStart ?? null,
			input.lineEnd ?? null,
			input.side ?? null,
			input.content,
		);

		return db
			.prepare('SELECT * FROM comments WHERE id = ?')
			.get(id) as Comment;
	},

	// Update a comment
	updateComment: (
		id: string,
		input: UpdateCommentInput,
	): Comment | undefined => {
		const db = getDatabase();
		const existing = commentService.getComment(id);
		if (!existing) return undefined;

		const updates: string[] = [];
		const values: unknown[] = [];

		if (input.content !== undefined) {
			updates.push('content = ?');
			values.push(input.content);
		}
		if (input.status !== undefined) {
			updates.push('status = ?');
			values.push(input.status);
		}

		if (updates.length === 0) return existing;

		values.push(id);
		db.prepare(
			`UPDATE comments SET ${updates.join(', ')} WHERE id = ?`,
		).run(...values);

		return db
			.prepare('SELECT * FROM comments WHERE id = ?')
			.get(id) as Comment;
	},

	// Delete a comment
	deleteComment: (id: string): boolean => {
		const db = getDatabase();
		const result = db.prepare('DELETE FROM comments WHERE id = ?').run(id);
		return result.changes > 0;
	},

	// Bulk update status
	updateCommentsStatus: (ids: string[], status: CommentStatus): number => {
		const db = getDatabase();
		const placeholders = ids.map(() => '?').join(', ');
		const result = db
			.prepare(
				`UPDATE comments SET status = ? WHERE id IN (${placeholders})`,
			)
			.run(status, ...ids);
		return result.changes;
	},

	// Stage comments (move from queued to staged)
	stageComments: (ids: string[]): number => {
		return commentService.updateCommentsStatus(ids, 'staged');
	},

	// Mark comments as sent
	markAsSent: (ids: string[]): number => {
		const db = getDatabase();
		const placeholders = ids.map(() => '?').join(', ');
		const result = db
			.prepare(
				`UPDATE comments SET status = 'sent', sent_at = datetime('now') WHERE id IN (${placeholders})`,
			)
			.run(...ids);
		return result.changes;
	},

	// Cancel comments
	cancelComments: (ids: string[]): number => {
		return commentService.updateCommentsStatus(ids, 'cancelled');
	},

	// Get comment counts by status for a session
	getCommentCounts: (sessionId: string): Record<CommentStatus, number> => {
		const db = getDatabase();
		const results = db
			.prepare(
				`
        SELECT status, COUNT(*) as count 
        FROM comments 
        WHERE session_id = ? 
        GROUP BY status
      `,
			)
			.all(sessionId) as { status: CommentStatus; count: number }[];

		const counts: Record<CommentStatus, number> = {
			queued: 0,
			staged: 0,
			sent: 0,
			cancelled: 0,
		};

		for (const row of results) {
			counts[row.status] = row.count;
		}

		return counts;
	},
};
