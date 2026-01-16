import { useState } from 'react';
import {
	VscCheck,
	VscClose,
	VscEdit,
	VscSend,
	VscTrash,
} from 'react-icons/vsc';
import { useFetcher } from 'react-router';
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
	const fetcher = useFetcher();

	const isDeleting =
		fetcher.state !== 'idle' &&
		fetcher.formData?.get('intent') === 'delete';
	const isUpdating =
		fetcher.state !== 'idle' &&
		fetcher.formData?.get('intent') === 'update';

	const handleSave = () => {
		fetcher.submit(
			{ intent: 'update', id: comment.id, content: editContent },
			{ method: 'POST', action: '/api/comments' },
		);
		setIsEditing(false);
	};

	const handleDelete = () => {
		fetcher.submit(
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
			className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${
				isDeleting ? 'opacity-50' : ''
			}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-2">
				<div className="text-xs text-gray-500 truncate flex-1">
					<span className="font-medium text-gray-700 dark:text-gray-300">
						{fileName}
					</span>
					{lineInfo && (
						<span className="ml-1 text-blue-500">{lineInfo}</span>
					)}
				</div>
				<div className="flex items-center gap-1 shrink-0">
					{showSendButton && onSendNow && (
						<button
							onClick={() => onSendNow(comment)}
							className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
							title="Send now"
						>
							<VscSend className="w-4 h-4" />
						</button>
					)}
					{!isEditing && (
						<>
							<button
								onClick={() => setIsEditing(true)}
								className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
								title="Edit"
							>
								<VscEdit className="w-4 h-4" />
							</button>
							<button
								onClick={handleDelete}
								className="p-1 text-gray-400 hover:text-red-500 transition-colors"
								title="Delete"
								disabled={isDeleting}
							>
								<VscTrash className="w-4 h-4" />
							</button>
						</>
					)}
				</div>
			</div>

			{/* Content */}
			{isEditing ? (
				<div className="space-y-2">
					<textarea
						value={editContent}
						onChange={(e) => setEditContent(e.target.value)}
						className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
						rows={3}
						autoFocus
					/>
					<div className="flex justify-end gap-2">
						<button
							onClick={handleCancel}
							className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							title="Cancel"
						>
							<VscClose className="w-4 h-4" />
						</button>
						<button
							onClick={handleSave}
							className="p-1 text-gray-400 hover:text-green-500"
							title="Save"
							disabled={isUpdating}
						>
							<VscCheck className="w-4 h-4" />
						</button>
					</div>
				</div>
			) : (
				<>
					<p className="text-sm whitespace-pre-wrap">
						{comment.content}
					</p>
					{showSentAt && comment.sent_at && (
						<p className="text-xs text-gray-400 mt-2">
							Sent {new Date(comment.sent_at).toLocaleString()}
						</p>
					)}
				</>
			)}
		</div>
	);
}
