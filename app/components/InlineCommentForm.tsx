import { useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { useFetcher } from 'react-router';

interface InlineCommentFormProps {
	sessionId: string;
	filePath: string;
	lineStart: number;
	lineEnd?: number;
	side?: 'old' | 'new' | 'both';
	onClose: () => void;
	onSendNow?: (content: string) => void;
}

export function InlineCommentForm({
	sessionId,
	filePath,
	lineStart,
	lineEnd,
	side,
	onClose,
	onSendNow,
}: InlineCommentFormProps) {
	const [content, setContent] = useState('');
	const fetcher = useFetcher();

	const isSubmitting = fetcher.state !== 'idle';

	const handleQueue = () => {
		if (!content.trim()) return;

		const formData = new FormData();
		formData.append('intent', 'create');
		formData.append('sessionId', sessionId);
		formData.append('filePath', filePath);
		formData.append('content', content);
		formData.append('lineStart', lineStart.toString());
		if (lineEnd) formData.append('lineEnd', lineEnd.toString());
		if (side) formData.append('side', side);

		fetcher.submit(formData, { method: 'POST', action: '/api/comments' });
		setContent('');
		onClose();
	};

	const handleSendNow = () => {
		if (!content.trim() || !onSendNow) return;
		onSendNow(content);
		setContent('');
		onClose();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
		} else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey && onSendNow) {
				// Cmd/Ctrl + Shift + Enter = Send Now
				handleSendNow();
			} else {
				// Cmd/Ctrl + Enter = Queue
				handleQueue();
			}
		}
	};

	const lineInfo =
		lineEnd && lineEnd !== lineStart
			? `Lines ${lineStart}-${lineEnd}`
			: `Line ${lineStart}`;

	return (
		<div
			data-comment-form
			className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 m-2 box-border"
			style={{ width: 'calc(100% - 16px)' }}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs text-gray-500">{lineInfo}</span>
				<button
					onClick={onClose}
					className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
				>
					<VscClose className="w-4 h-4" />
				</button>
			</div>

			{/* Textarea */}
			<textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Add a comment..."
				className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
				rows={3}
				autoFocus
			/>

			{/* Actions */}
			<div className="flex items-center justify-end mt-2 gap-2">
				<button
					onClick={onClose}
					className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
				>
					Cancel
					<kbd className="px-1 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 rounded">
						Esc
					</kbd>
				</button>
				{onSendNow && (
					<button
						onClick={handleSendNow}
						disabled={!content.trim() || isSubmitting}
						className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
					>
						Send Now
						<kbd className="px-1 py-0.5 text-[10px] bg-green-600 rounded">
							⌘⇧↵
						</kbd>
					</button>
				)}
				<button
					onClick={handleQueue}
					disabled={!content.trim() || isSubmitting}
					className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
				>
					Queue
					<kbd className="px-1 py-0.5 text-[10px] bg-blue-600 rounded">
						⌘↵
					</kbd>
				</button>
			</div>
		</div>
	);
}
