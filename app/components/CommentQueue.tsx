import { Button, Checkbox, Text } from '@radix-ui/themes';
import { useState } from 'react';
import {
	VscCheck,
	VscChevronDown,
	VscChevronRight,
	VscInbox,
	VscSend,
} from 'react-icons/vsc';
import { useAsyncAction } from '../lib/use-async-action';
import type { Comment } from '../services/comment.service';
import { CommentCard } from './CommentCard';
import { SessionSelector } from './SessionSelector';

interface CommentQueueProps {
	sessionId: string;
	queuedComments: Comment[];
	stagedComments: Comment[];
	sentComments: Comment[];
	selectedTmuxSession: string | null;
	onSelectTmuxSession: (sessionName: string) => void;
	onSendNow?: (comment: Comment) => void;
	onSendAllStaged?: () => void;
	repoPath?: string;
}

export function CommentQueue({
	sessionId,
	queuedComments,
	stagedComments,
	sentComments,
	selectedTmuxSession,
	onSelectTmuxSession,
	onSendNow,
	onSendAllStaged,
	repoPath,
}: CommentQueueProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [queueExpanded, setQueueExpanded] = useState(true);
	const [stagedExpanded, setStagedExpanded] = useState(true);
	const [sentExpanded, setSentExpanded] = useState(true);

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

	return (
		<div className="h-full flex flex-col">
			{/* Panel header */}
			<div className="panel-header">
				<span>Comments</span>
			</div>

			{/* Session Selector */}
			<div
				className="p-4 border-b"
				style={{ borderColor: 'var(--color-border)' }}
			>
				<Text
					size="1"
					weight="medium"
					className="mb-2 block"
					style={{ color: 'var(--color-text-secondary)' }}
				>
					Target Session
				</Text>
				<SessionSelector
					selectedSession={selectedTmuxSession}
					onSelectSession={onSelectTmuxSession}
					repoPath={repoPath}
				/>
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
													showSendButton={
														!!selectedTmuxSession
													}
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
								{/* Send all button */}
								<div className="mb-3 pt-2">
									<Button
										size="2"
										className="w-full btn-press"
										style={{
											backgroundColor:
												'var(--color-success-green)',
										}}
										onClick={onSendAllStaged}
										disabled={!selectedTmuxSession}
									>
										<VscSend aria-hidden="true" />
										Send All ({stagedComments.length})
									</Button>
									{!selectedTmuxSession && (
										<Text
											size="1"
											className="mt-2 text-center block"
											style={{
												color: 'var(--color-text-muted)',
											}}
										>
											Select a session to send
										</Text>
									)}
								</div>

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
			<div className="section-accordion section-sent flex-1 overflow-y-auto">
				<button
					onClick={() => setSentExpanded(!sentExpanded)}
					className="section-accordion-header sticky top-0 z-10"
					style={{ backgroundColor: 'var(--color-bg)' }}
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
		</div>
	);
}
