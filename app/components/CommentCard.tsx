import { Button, IconButton, Text, TextArea, Tooltip } from '@radix-ui/themes';
import { useRef, useState } from 'react';
import {
	VscCheck,
	VscClose,
	VscEdit,
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
}

export function CommentCard({
	comment,
	onSendNow,
	showSendButton = false,
	showSentAt = false,
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
			className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col gap-2 ${
				isDeleting ? 'opacity-50' : ''
			}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="text-xs text-gray-500 truncate flex-1 flex items-center gap-1">
					<Text size="1" weight="medium">
						{fileName}
					</Text>
					{lineInfo && (
						<Text size="1" color="blue">
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
				<div className="flex flex-col gap-2">
					<TextArea
						value={editContent}
						onChange={(e) => setEditContent(e.target.value)}
						size="1"
						rows={3}
						autoFocus
						aria-label="Edit comment text"
					/>
					<div className="flex justify-end gap-1">
						<Tooltip content="Cancel">
							<IconButton
								size="1"
								variant="ghost"
								onClick={handleCancel}
								aria-label="Cancel editing"
							>
								<VscClose aria-hidden="true" />
							</IconButton>
						</Tooltip>
						<Tooltip content="Save">
							<IconButton
								size="1"
								variant="ghost"
								color="green"
								onClick={handleSave}
								aria-label="Save changes"
								disabled={isUpdating}
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
						<Text size="2" className="whitespace-pre-wrap">
							{comment.content}
						</Text>
						{!isExpanded && comment.content.length > 100 && (
							<div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-gray-900 to-transparent" />
						)}
					</div>
					{comment.content.length > 100 && (
						<Button
							variant="ghost"
							size="1"
							onClick={() => setIsExpanded(!isExpanded)}
							className="px-0"
						>
							{isExpanded ? 'Show less' : 'Show more'}
						</Button>
					)}
					{showSentAt && comment.sent_at && (
						<Text size="1" color="gray">
							Sent {new Date(comment.sent_at).toLocaleString()}
						</Text>
					)}
				</>
			)}
		</div>
	);
}
