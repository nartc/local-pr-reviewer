import { Button, IconButton, Text, TextArea, Tooltip } from '@radix-ui/themes';
import { useRef, useState } from 'react';
import {
	VscCheck,
	VscClose,
	VscEdit,
	VscFile,
	VscSend,
	VscTrash,
} from 'react-icons/vsc';
import { useAsyncAction } from '../lib/use-async-action';
import type { Comment } from '../services/comment.service';

interface CommentCardProps {
	comment: Comment;
	onSendNow?: (comment: Comment) => void;
	showSendButton?: boolean;
	showSentAt?: boolean;
	showResolvedAt?: boolean;
}

export function CommentCard({
	comment,
	onSendNow,
	showSendButton = false,
	showSentAt = false,
	showResolvedAt = false,
}: CommentCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [isExpanded, setIsExpanded] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);

	const { submit: submitUpdate, isPending: isUpdating } = useAsyncAction({
		successMessage: 'Comment updated',
		onSuccess: () => setIsEditing(false),
	});

	const { submit: submitDelete, isPending: isDeleting } = useAsyncAction({
		successMessage: 'Comment deleted',
	});

	const handleSave = () => {
		submitUpdate(
			{ intent: 'update', id: comment.id, content: editContent },
			{ method: 'POST', action: '/api/comments' },
		);
	};

	const handleDelete = () => {
		submitDelete(
			{ intent: 'delete', id: comment.id },
			{ method: 'POST', action: '/api/comments' },
		);
	};

	const handleCancel = () => {
		setEditContent(comment.content);
		setIsEditing(false);
	};

	const fileName = comment.file_path.split('/').pop();
	const lineInfo = comment.line_start
		? comment.line_end && comment.line_end !== comment.line_start
			? `L${comment.line_start}-${comment.line_end}`
			: `L${comment.line_start}`
		: null;

	return (
		<div
			className={`card-hover p-3 flex flex-col gap-2 ${isDeleting ? 'opacity-50' : ''}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0 flex-1">
					<VscFile
						className="w-3.5 h-3.5 shrink-0"
						style={{ color: 'var(--color-text-muted)' }}
					/>
					<Text
						size="1"
						weight="medium"
						className="truncate"
						style={{ color: 'var(--color-text-secondary)' }}
					>
						{fileName}
					</Text>
					{lineInfo && (
						<Text
							size="1"
							className="shrink-0"
							style={{ color: 'var(--color-accent)' }}
						>
							{lineInfo}
						</Text>
					)}
				</div>
				<div className="flex items-center gap-1 shrink-0">
					{showSendButton && onSendNow && (
						<Tooltip content="Send now">
							<IconButton
								size="1"
								variant="ghost"
								onClick={() => onSendNow(comment)}
								aria-label="Send now"
								className="btn-press"
							>
								<VscSend aria-hidden="true" />
							</IconButton>
						</Tooltip>
					)}
					{!isEditing && !showSentAt && (
						<>
							<Tooltip content="Edit">
								<IconButton
									size="1"
									variant="ghost"
									onClick={() => setIsEditing(true)}
									aria-label="Edit comment"
									className="btn-press"
								>
									<VscEdit aria-hidden="true" />
								</IconButton>
							</Tooltip>
							<Tooltip content="Delete">
								<IconButton
									size="1"
									variant="ghost"
									color="red"
									onClick={handleDelete}
									aria-label="Delete comment"
									disabled={isDeleting}
									className="btn-press"
								>
									<VscTrash aria-hidden="true" />
								</IconButton>
							</Tooltip>
						</>
					)}
				</div>
			</div>

			{/* Content */}
			{isEditing ? (
				<div className="flex flex-col gap-2 animate-slide-in">
					<TextArea
						value={editContent}
						onChange={(e) => setEditContent(e.target.value)}
						size="1"
						rows={3}
						autoFocus
						aria-label="Edit comment text"
						style={{
							backgroundColor: 'var(--color-bg)',
							borderColor: 'var(--color-border)',
						}}
					/>
					<div className="flex justify-end gap-1">
						<Tooltip content="Cancel (Esc)">
							<IconButton
								size="1"
								variant="ghost"
								onClick={handleCancel}
								aria-label="Cancel editing"
								className="btn-press"
							>
								<VscClose aria-hidden="true" />
							</IconButton>
						</Tooltip>
						<Tooltip content="Save">
							<IconButton
								size="1"
								variant="soft"
								color="green"
								onClick={handleSave}
								aria-label="Save changes"
								disabled={isUpdating}
								className="btn-press"
							>
								<VscCheck aria-hidden="true" />
							</IconButton>
						</Tooltip>
					</div>
				</div>
			) : (
				<>
					<div
						ref={contentRef}
						className={`relative ${!isExpanded ? 'max-h-[4.5em] overflow-hidden' : ''}`}
					>
						<Text
							size="2"
							className="whitespace-pre-wrap"
							style={{ color: 'var(--color-text-primary)' }}
						>
							{comment.content}
						</Text>
						{!isExpanded && comment.content.length > 100 && (
							<div
								className="absolute bottom-0 left-0 right-0 h-6"
								style={{
									background: `linear-gradient(to top, var(--color-surface), transparent)`,
								}}
							/>
						)}
					</div>
					{comment.content.length > 100 && (
						<Button
							variant="ghost"
							size="1"
							onClick={() => setIsExpanded(!isExpanded)}
							className="self-start px-0"
						>
							{isExpanded ? 'Show less' : 'Show more'}
						</Button>
					)}
					{showSentAt && comment.sent_at && (
						<Text
							size="1"
							className="flex items-center gap-1"
							style={{ color: 'var(--color-text-muted)' }}
						>
							<VscCheck
								className="w-3 h-3"
								style={{ color: 'var(--color-success-green)' }}
							/>
							Sent {new Date(comment.sent_at).toLocaleString()}
						</Text>
					)}
					{showResolvedAt && comment.resolved_at && (
						<Text
							size="1"
							className="flex items-center gap-1"
							style={{ color: 'var(--color-text-muted)' }}
						>
							<VscCheck
								className="w-3 h-3"
								style={{ color: 'var(--color-success-green)' }}
							/>
							Resolved{' '}
							{new Date(comment.resolved_at).toLocaleString()}
							{comment.resolved_by &&
								` by ${comment.resolved_by}`}
						</Text>
					)}
				</>
			)}
		</div>
	);
}
