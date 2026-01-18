import { Button, Checkbox, Text } from '@radix-ui/themes';
import { useCallback, useState } from 'react';
import {
	VscCheck,
	VscChevronDown,
	VscChevronRight,
	VscInbox,
	VscLightbulb,
	VscSend,
} from 'react-icons/vsc';
import { useAsyncAction } from '../lib/use-async-action';
import type { Comment } from '../services/comment.service';
import { CommentCard } from './comment-card';

interface CommentQueueProps {
	sessionId: string;
	queuedComments: Comment[];
	stagedComments: Comment[];
	sentComments: Comment[];
	resolvedComments: Comment[];
	onSendNow?: (comment: Comment) => void;
	onSendAllStaged?: () => void;
	onProcessComments?: (commentIds: string[]) => Promise<string | null>;
}

export function CommentQueue({
	sessionId,
	queuedComments,
	stagedComments,
	sentComments,
	resolvedComments,
	onSendNow,
	onSendAllStaged,
	onProcessComments,
}: CommentQueueProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [queueExpanded, setQueueExpanded] = useState(true);
	const [stagedExpanded, setStagedExpanded] = useState(true);
	const [sentExpanded, setSentExpanded] = useState(false);
	const [resolvedExpanded, setResolvedExpanded] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processedText, setProcessedText] = useState<string | null>(null);

	const { submit, isPending: isStaging } = useAsyncAction({
		successMessage: 'Comments staged',
		onSuccess: () => setSelectedIds(new Set()),
	});

	const toggleSelect = (id: string) => {
		const newSelected = new Set(selectedIds);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedIds(newSelected);
	};

	const selectAll = () => {
		if (selectedIds.size === queuedComments.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(queuedComments.map((c) => c.id)));
		}
	};

	const handleStageSelected = () => {
		if (selectedIds.size === 0) return;

		const formData = new FormData();
		formData.append('intent', 'stage');
		selectedIds.forEach((id) => formData.append('ids', id));

		submit(formData, { method: 'POST', action: '/api/comments' });
	};

	const handleProcessStaged = useCallback(async () => {
		if (!onProcessComments || stagedComments.length === 0) return;

		setIsProcessing(true);
		setProcessedText(null);

		try {
			const result = await onProcessComments(
				stagedComments.map((c) => c.id),
			);
			if (result) {
				setProcessedText(result);
			}
		} finally {
			setIsProcessing(false);
		}
	}, [onProcessComments, stagedComments]);

	return (
		<div className="h-full flex flex-col">
			{/* Panel header */}
			<div className="panel-header">
				<span>Comments</span>
			</div>

			{/* Queued Section */}
			<div className="section-accordion section-queued">
				<button
					onClick={() => setQueueExpanded(!queueExpanded)}
					className="section-accordion-header"
					aria-expanded={queueExpanded}
					aria-controls="queued-comments-section"
				>
					<div className="flex items-center gap-2">
						{queueExpanded ? (
							<VscChevronDown
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						) : (
							<VscChevronRight
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						)}
						<Text size="2" weight="bold">
							Queued
						</Text>
						<span className="count-badge">
							{queuedComments.length}
						</span>
					</div>
				</button>

				{queueExpanded && (
					<div id="queued-comments-section" className="px-4 pb-4">
						{queuedComments.length === 0 ? (
							<div className="flex flex-col items-center py-6 gap-2">
								<VscInbox
									className="w-8 h-8"
									style={{ color: 'var(--color-text-muted)' }}
								/>
								<Text
									size="2"
									style={{ color: 'var(--color-text-muted)' }}
								>
									No queued comments
								</Text>
								<Text
									size="1"
									style={{ color: 'var(--color-text-muted)' }}
								>
									Add comments from the diff viewer
								</Text>
							</div>
						) : (
							<>
								{/* Selection controls */}
								<div className="flex items-center justify-between mb-3 pt-2">
									<Button
										variant="ghost"
										size="1"
										onClick={selectAll}
									>
										{selectedIds.size ===
										queuedComments.length
											? 'Deselect all'
											: 'Select all'}
									</Button>
									{selectedIds.size > 0 && (
										<div className="flex items-center gap-2">
											<Button
												variant="soft"
												size="1"
												onClick={handleStageSelected}
												disabled={isStaging}
												className="btn-press"
											>
												Stage ({selectedIds.size})
											</Button>
										</div>
									)}
								</div>

								{/* Comment list */}
								<div className="space-y-2">
									{queuedComments.map((comment) => (
										<div
											key={comment.id}
											className="flex items-start gap-2 animate-fade-in-up"
										>
											<Checkbox
												checked={selectedIds.has(
													comment.id,
												)}
												onCheckedChange={() =>
													toggleSelect(comment.id)
												}
												aria-label={`Select comment for ${comment.file_path}`}
												className="mt-3"
											/>
											<div className="flex-1 min-w-0">
												<CommentCard
													comment={comment}
													onSendNow={onSendNow}
													showSendButton
												/>
											</div>
										</div>
									))}
								</div>
							</>
						)}
					</div>
				)}
			</div>

			{/* Staged Section */}
			<div className="section-accordion section-staged">
				<button
					onClick={() => setStagedExpanded(!stagedExpanded)}
					className="section-accordion-header"
					aria-expanded={stagedExpanded}
					aria-controls="staged-comments-section"
				>
					<div className="flex items-center gap-2">
						{stagedExpanded ? (
							<VscChevronDown
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						) : (
							<VscChevronRight
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						)}
						<Text size="2" weight="bold">
							Staged
						</Text>
						<span className="count-badge">
							{stagedComments.length}
						</span>
					</div>
					{stagedComments.length > 0 && (
						<VscCheck className="w-4 h-4 text-zinc-500" />
					)}
				</button>

				{stagedExpanded && (
					<div id="staged-comments-section" className="px-4 pb-4">
						{stagedComments.length === 0 ? (
							<div className="flex flex-col items-center py-6 gap-2">
								<Text
									size="2"
									style={{ color: 'var(--color-text-muted)' }}
								>
									No staged comments
								</Text>
								<Text
									size="1"
									style={{ color: 'var(--color-text-muted)' }}
								>
									Select and stage comments from the queue
								</Text>
							</div>
						) : (
							<>
								{/* Action buttons */}
								<div className="mb-3 pt-2 flex items-center gap-2">
									<Button
										size="2"
										variant="soft"
										className="w-full btn-press"
										onClick={handleProcessStaged}
										disabled={isProcessing}
									>
										<VscLightbulb aria-hidden="true" />
										{isProcessing
											? 'Processing...'
											: 'Process with AI'}
									</Button>
									<Button
										size="2"
										className="w-full btn-press"
										style={{
											backgroundColor:
												'var(--color-success-green)',
										}}
										onClick={onSendAllStaged}
									>
										<VscSend aria-hidden="true" />
										Send All ({stagedComments.length})
									</Button>
								</div>

								{/* Processed text output */}
								{processedText && (
									<div
										className="mb-3 p-3 rounded-md text-sm whitespace-pre-wrap"
										style={{
											backgroundColor:
												'var(--color-bg-secondary)',
											border: '1px solid var(--color-border)',
										}}
									>
										<Text
											size="1"
											weight="medium"
											className="mb-2 block"
											style={{
												color: 'var(--color-text-secondary)',
											}}
										>
											AI Processed Output
										</Text>
										{processedText}
									</div>
								)}

								{/* Staged comment list */}
								<div className="space-y-2">
									{stagedComments.map((comment) => (
										<div
											key={comment.id}
											className="animate-fade-in-up"
										>
											<CommentCard comment={comment} />
										</div>
									))}
								</div>
							</>
						)}
					</div>
				)}
			</div>

			{/* Sent Section */}
			<div className="section-accordion section-sent">
				<button
					onClick={() => setSentExpanded(!sentExpanded)}
					className="section-accordion-header"
					aria-expanded={sentExpanded}
					aria-controls="sent-comments-section"
				>
					<div className="flex items-center gap-2">
						{sentExpanded ? (
							<VscChevronDown
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						) : (
							<VscChevronRight
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						)}
						<Text size="2" weight="bold">
							Sent
						</Text>
						<span className="count-badge">
							{sentComments.length}
						</span>
					</div>
				</button>

				{sentExpanded && (
					<div id="sent-comments-section" className="px-4 pb-4">
						{sentComments.length === 0 ? (
							<div className="flex flex-col items-center py-6 gap-2">
								<Text
									size="2"
									style={{ color: 'var(--color-text-muted)' }}
								>
									No sent comments
								</Text>
								<Text
									size="1"
									style={{ color: 'var(--color-text-muted)' }}
								>
									Sent comments will appear here
								</Text>
							</div>
						) : (
							<div className="space-y-2 pt-2">
								{sentComments.map((comment) => (
									<div
										key={comment.id}
										className="opacity-75"
									>
										<CommentCard
											comment={comment}
											showSentAt
										/>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Resolved Section */}
			<div className="section-accordion section-resolved flex-1 overflow-y-auto">
				<button
					onClick={() => setResolvedExpanded(!resolvedExpanded)}
					className="section-accordion-header sticky top-0 z-10"
					style={{ backgroundColor: 'var(--color-bg)' }}
					aria-expanded={resolvedExpanded}
					aria-controls="resolved-comments-section"
				>
					<div className="flex items-center gap-2">
						{resolvedExpanded ? (
							<VscChevronDown
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						) : (
							<VscChevronRight
								className="w-4 h-4"
								style={{ color: 'var(--color-text-muted)' }}
							/>
						)}
						<Text size="2" weight="bold">
							Resolved
						</Text>
						<span className="count-badge">
							{resolvedComments.length}
						</span>
					</div>
				</button>

				{resolvedExpanded && (
					<div id="resolved-comments-section" className="px-4 pb-4">
						{resolvedComments.length === 0 ? (
							<div className="flex flex-col items-center py-6 gap-2">
								<Text
									size="2"
									style={{ color: 'var(--color-text-muted)' }}
								>
									No resolved comments
								</Text>
								<Text
									size="1"
									style={{ color: 'var(--color-text-muted)' }}
								>
									Comments resolved by agents appear here
								</Text>
							</div>
						) : (
							<div className="space-y-2 pt-2">
								{resolvedComments.map((comment) => (
									<div
										key={comment.id}
										className="opacity-50"
									>
										<CommentCard
											comment={comment}
											showResolvedAt
										/>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
