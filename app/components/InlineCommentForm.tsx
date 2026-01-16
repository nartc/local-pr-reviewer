import {
	Button,
	IconButton,
	Kbd,
	Text,
	TextArea,
	Tooltip,
} from '@radix-ui/themes';
import { useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { useAsyncAction } from '../lib/use-async-action';

interface InlineCommentFormProps {
	sessionId: string;
	filePath: string;
	lineStart?: number;
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
	const { submit, isPending } = useAsyncAction({
		successMessage: 'Comment queued',
		onSuccess: () => {
			setContent('');
			onClose();
		},
	});

	const handleQueue = () => {
		if (!content.trim()) return;

		const formData = new FormData();
		formData.append('intent', 'create');
		formData.append('sessionId', sessionId);
		formData.append('filePath', filePath);
		formData.append('content', content);
		if (lineStart) formData.append('lineStart', lineStart.toString());
		if (lineEnd) formData.append('lineEnd', lineEnd.toString());
		if (side) formData.append('side', side);

		submit(formData, { method: 'POST', action: '/api/comments' });
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

	const lineInfo = lineStart
		? lineEnd && lineEnd !== lineStart
			? `Lines ${lineStart}-${lineEnd}`
			: `Line ${lineStart}`
		: 'File comment';

	return (
		<div
			data-comment-form
			className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 m-2 box-border w-[calc(100%-1rem)]"
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-2">
				<Text size="1" color="gray">
					{lineInfo}
				</Text>
				<Tooltip content="Close">
					<IconButton
						size="1"
						variant="ghost"
						onClick={onClose}
						aria-label="Close comment form"
					>
						<VscClose aria-hidden="true" />
					</IconButton>
				</Tooltip>
			</div>

			{/* Textarea */}
			<TextArea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Add a comment..."
				size="2"
				rows={3}
				autoFocus
				aria-label="Comment text"
			/>

			{/* Actions */}
			<div className="flex items-center justify-end mt-2 gap-2">
				<Button variant="ghost" size="1" onClick={onClose}>
					Cancel <Kbd size="1">Esc</Kbd>
				</Button>
				{onSendNow && (
					<Button
						size="1"
						color="green"
						onClick={handleSendNow}
						disabled={!content.trim() || isPending}
					>
						Send Now <Kbd size="1">⌘⇧↵</Kbd>
					</Button>
				)}
				<Button
					size="1"
					onClick={handleQueue}
					disabled={!content.trim() || isPending}
				>
					Queue <Kbd size="1">⌘↵</Kbd>
				</Button>
			</div>
		</div>
	);
}
