import { Badge, Button, IconButton, Popover, Tooltip } from '@radix-ui/themes';
import { useState } from 'react';
import { VscAdd, VscComment } from 'react-icons/vsc';
import type { Comment } from '../../services/comment.service';
import type { HoveredLineResult } from './types';

/**
 * Simple add comment button shown on hover.
 * Lines with existing comments show persistent indicators via annotations.
 */
export function HoverAddCommentButton({
	getHoveredLine,
	filePath,
	handleAddComment,
}: {
	getHoveredLine: () => HoveredLineResult | undefined;
	filePath: string;
	handleAddComment: (
		filePath: string,
		getHoveredLine: () => HoveredLineResult | undefined,
	) => void;
}) {
	return (
		<Tooltip content="Add comment">
			<IconButton
				size="1"
				variant="solid"
				aria-label="Add comment"
				onClick={() => handleAddComment(filePath, getHoveredLine)}
			>
				<VscAdd className="w-3 h-3" />
			</IconButton>
		</Tooltip>
	);
}

/**
 * Badge shown in the gutter for lines with existing comments.
 * Renders as a small icon that opens a popover on click.
 */
export function GutterCommentBadge({
	comments,
	lineNumber,
	filePath,
	sessionId,
	onCommentChange,
	onAddComment,
}: {
	comments: Comment[];
	lineNumber: number;
	filePath: string;
	sessionId: string;
	onCommentChange?: () => void;
	onAddComment: () => void;
}) {
	const hasEditableComments = comments.some(
		(c) => c.status === 'queued' || c.status === 'staged',
	);

	return (
		<div className="flex items-center gap-1 py-1">
			<Popover.Root>
				<Popover.Trigger>
					<IconButton
						size="1"
						variant="soft"
						color={hasEditableComments ? 'amber' : 'blue'}
						aria-label={`${comments.length} comment${comments.length > 1 ? 's' : ''} on line ${lineNumber}`}
					>
						<VscComment className="w-3 h-3" />
						{comments.length > 1 && (
							<span className="text-[10px] ml-0.5">
								{comments.length}
							</span>
						)}
					</IconButton>
				</Popover.Trigger>
				<Popover.Content
					side="right"
					align="start"
					className="w-80 max-h-96 overflow-auto"
				>
					<div className="space-y-3">
						<span className="text-sm font-medium">
							Comments on line {lineNumber}
						</span>

						{/* List existing comments */}
						<div className="space-y-2">
							{comments.map((comment) => (
								<CommentPreviewCard
									key={comment.id}
									comment={comment}
									sessionId={sessionId}
									onCommentChange={onCommentChange}
								/>
							))}
						</div>

						{/* Add new comment button */}
						<Popover.Close>
							<Button
								size="1"
								variant="soft"
								className="w-full"
								onClick={onAddComment}
							>
								<VscAdd className="w-3 h-3" />
								Add another comment
							</Button>
						</Popover.Close>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	);
}

/**
 * Small preview card for a comment in the gutter popover
 */
export function CommentPreviewCard({
	comment,
	sessionId,
	onCommentChange,
}: {
	comment: Comment;
	sessionId: string;
	onCommentChange?: () => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [isSaving, setIsSaving] = useState(false);

	const isEditable =
		comment.status === 'queued' || comment.status === 'staged';
	const statusColors: Record<string, 'amber' | 'blue' | 'green' | 'gray'> = {
		queued: 'amber',
		staged: 'blue',
		sent: 'green',
		resolved: 'gray',
	};

	const handleSave = async () => {
		if (!editContent.trim()) return;
		setIsSaving(true);

		try {
			const formData = new URLSearchParams();
			formData.append('intent', 'update');
			formData.append('commentId', comment.id);
			formData.append('content', editContent);

			await fetch('/api/comments', {
				method: 'POST',
				body: formData,
			});

			setIsEditing(false);
			onCommentChange?.();
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		try {
			const formData = new URLSearchParams();
			formData.append('intent', 'delete');
			formData.append('commentId', comment.id);

			await fetch('/api/comments', {
				method: 'POST',
				body: formData,
			});

			onCommentChange?.();
		} catch (error) {
			console.error('Failed to delete comment:', error);
		}
	};

	if (isEditing) {
		return (
			<div className="p-2 rounded-md border border-theme-border bg-theme-surface space-y-2">
				<textarea
					value={editContent}
					onChange={(e) => setEditContent(e.target.value)}
					className="w-full p-2 text-sm rounded border border-theme-border bg-theme-bg resize-none"
					rows={3}
					autoFocus
				/>
				<div className="flex gap-2 justify-end">
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => {
							setIsEditing(false);
							setEditContent(comment.content);
						}}
						disabled={isSaving}
					>
						Cancel
					</Button>
					<Button
						size="1"
						variant="solid"
						onClick={handleSave}
						disabled={isSaving || !editContent.trim()}
					>
						{isSaving ? 'Saving...' : 'Save'}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="p-2 rounded-md border border-theme-border bg-theme-surface">
			<div className="flex items-start justify-between gap-2">
				<span className="text-xs line-clamp-3 flex-1">
					{comment.content}
				</span>
				<Badge
					size="1"
					color={statusColors[comment.status] || 'gray'}
					variant="soft"
				>
					{comment.status}
				</Badge>
			</div>
			{isEditable && (
				<div className="flex gap-2 mt-2">
					<Button
						size="1"
						variant="ghost"
						onClick={() => setIsEditing(true)}
					>
						Edit
					</Button>
					<Button
						size="1"
						variant="ghost"
						color="red"
						onClick={handleDelete}
					>
						Delete
					</Button>
				</div>
			)}
		</div>
	);
}
