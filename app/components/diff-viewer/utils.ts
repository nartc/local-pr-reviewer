import type { ChangeContent, ContextContent, Hunk } from '@pierre/diffs';
import type { Comment } from '../../services/comment.service';
import { AUTO_COLLAPSE_PATTERNS } from './constants';
import type { CommentMap } from './types';

/**
 * Check if a file should be auto-collapsed based on patterns or size
 */
export function shouldAutoCollapseFile(
	filePath: string,
	totalChanges: number,
	threshold: number,
): boolean {
	// Check if file matches auto-collapse patterns
	if (AUTO_COLLAPSE_PATTERNS.some((pattern) => pattern.test(filePath))) {
		return true;
	}
	// Check if file has too many changes
	if (totalChanges > threshold) {
		return true;
	}
	return false;
}

/**
 * Calculate the actual changed line range within a hunk.
 * The hunk's additionStart/additionLines includes context lines,
 * but we want the actual first and last changed (added) lines.
 */
export function getActualChangedLineRange(hunk: Hunk): {
	start: number;
	end: number;
} {
	let lineNumber = hunk.additionStart;
	let firstChangeLine: number | null = null;
	let lastChangeLine: number | null = null;

	for (const content of hunk.hunkContent) {
		if (content.type === 'context') {
			lineNumber += (content as ContextContent).lines.length;
		} else if (content.type === 'change') {
			const changeContent = content as ChangeContent;
			if (changeContent.additions.length > 0) {
				if (firstChangeLine === null) {
					firstChangeLine = lineNumber;
				}
				lineNumber += changeContent.additions.length;
				lastChangeLine = lineNumber - 1;
			}
		}
	}

	// Fallback to hunk range if no changes found
	return {
		start: firstChangeLine ?? hunk.additionStart,
		end: lastChangeLine ?? hunk.additionStart + hunk.additionLines - 1,
	};
}

/**
 * Build a map of comments by file path and line number for quick lookup
 */
export function buildCommentMap(comments: Comment[]): CommentMap {
	const map: CommentMap = new Map();

	for (const comment of comments) {
		if (!map.has(comment.file_path)) {
			map.set(comment.file_path, new Map());
		}
		const fileMap = map.get(comment.file_path)!;

		// For single line comments or file-level comments
		if (comment.line_start !== null) {
			const lineKey = comment.line_start;
			if (!fileMap.has(lineKey)) {
				fileMap.set(lineKey, []);
			}
			fileMap.get(lineKey)!.push(comment);

			// For multi-line comments, also index by end line
			if (
				comment.line_end !== null &&
				comment.line_end !== comment.line_start
			) {
				if (!fileMap.has(comment.line_end)) {
					fileMap.set(comment.line_end, []);
				}
				// Only add if not already there (avoid duplicates)
				const endLineComments = fileMap.get(comment.line_end)!;
				if (!endLineComments.includes(comment)) {
					endLineComments.push(comment);
				}
			}
		}
	}

	return map;
}
