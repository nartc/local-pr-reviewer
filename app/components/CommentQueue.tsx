import { useState } from 'react';
import { VscChevronDown, VscChevronRight, VscSend } from 'react-icons/vsc';
import { useFetcher } from 'react-router';
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
	const fetcher = useFetcher();

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

		fetcher.submit(formData, { method: 'POST', action: '/api/comments' });
		setSelectedIds(new Set());
	};

	const handleStageRaw = () => {
		// Stage without AI processing - just move to staged
		handleStageSelected();
	};

	const isStaging = fetcher.state !== 'idle';

	return (
		<div className="h-full flex flex-col">
			{/* Session Selector */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700">
				<div className="text-xs font-semibold text-gray-500 mb-2">
					Target Session
				</div>
				<SessionSelector
					selectedSession={selectedTmuxSession}
					onSelectSession={onSelectTmuxSession}
					repoPath={repoPath}
				/>
			</div>

			{/* Queued Section */}
			<div className="border-b border-gray-200 dark:border-gray-700">
				<button
					onClick={() => setQueueExpanded(!queueExpanded)}
					className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
				>
					<div className="flex items-center gap-2">
						{queueExpanded ? (
							<VscChevronDown className="w-4 h-4" />
						) : (
							<VscChevronRight className="w-4 h-4" />
						)}
						<span className="font-semibold text-sm">Queued</span>
						<span className="text-xs text-gray-500">
							({queuedComments.length})
						</span>
					</div>
				</button>

				{queueExpanded && (
					<div className="px-4 pb-4">
						{queuedComments.length === 0 ? (
							<p className="text-sm text-gray-500 py-2">
								No queued comments
							</p>
						) : (
							<>
								{/* Selection controls */}
								<div className="flex items-center justify-between mb-3">
									<button
										onClick={selectAll}
										className="text-xs text-blue-500 hover:text-blue-600"
									>
										{selectedIds.size ===
										queuedComments.length
											? 'Deselect all'
											: 'Select all'}
									</button>
									{selectedIds.size > 0 && (
										<div className="flex items-center gap-2">
											<button
												onClick={handleStageRaw}
												disabled={isStaging}
												className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
											>
												Stage Raw
											</button>
											<button
												onClick={handleStageSelected}
												disabled={isStaging}
												className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
											>
												Process & Stage
											</button>
										</div>
									)}
								</div>

								{/* Comment list */}
								<div className="space-y-2">
									{queuedComments.map((comment) => (
										<div
											key={comment.id}
											className="flex items-start gap-2"
										>
											<input
												type="checkbox"
												checked={selectedIds.has(
													comment.id,
												)}
												onChange={() =>
													toggleSelect(comment.id)
												}
												className="mt-3 shrink-0"
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
			<div className="border-b border-gray-200 dark:border-gray-700">
				<button
					onClick={() => setStagedExpanded(!stagedExpanded)}
					className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
				>
					<div className="flex items-center gap-2">
						{stagedExpanded ? (
							<VscChevronDown className="w-4 h-4" />
						) : (
							<VscChevronRight className="w-4 h-4" />
						)}
						<span className="font-semibold text-sm">Staged</span>
						<span className="text-xs text-gray-500">
							({stagedComments.length})
						</span>
					</div>
				</button>

				{stagedExpanded && (
					<div className="px-4 pb-4">
						{stagedComments.length === 0 ? (
							<p className="text-sm text-gray-500 py-2">
								No staged comments
							</p>
						) : (
							<>
								{/* Send all button */}
								<div className="mb-3">
									<button
										onClick={onSendAllStaged}
										disabled={!selectedTmuxSession}
										className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<VscSend className="w-4 h-4" />
										Send All Staged ({stagedComments.length}
										)
									</button>
									{!selectedTmuxSession && (
										<p className="text-xs text-gray-500 mt-1 text-center">
											Select a tmux session first
										</p>
									)}
								</div>

								{/* Staged comment list */}
								<div className="space-y-2">
									{stagedComments.map((comment) => (
										<CommentCard
											key={comment.id}
											comment={comment}
										/>
									))}
								</div>
							</>
						)}
					</div>
				)}
			</div>

			{/* Sent Section */}
			<div className="flex-1 overflow-y-auto">
				<button
					onClick={() => setSentExpanded(!sentExpanded)}
					className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
				>
					<div className="flex items-center gap-2">
						{sentExpanded ? (
							<VscChevronDown className="w-4 h-4" />
						) : (
							<VscChevronRight className="w-4 h-4" />
						)}
						<span className="font-semibold text-sm">Sent</span>
						<span className="text-xs text-gray-500">
							({sentComments.length})
						</span>
					</div>
				</button>

				{sentExpanded && (
					<div className="px-4 pb-4">
						{sentComments.length === 0 ? (
							<p className="text-sm text-gray-500 py-2">
								No sent comments
							</p>
						) : (
							<div className="space-y-2">
								{sentComments.map((comment) => (
									<CommentCard
										key={comment.id}
										comment={comment}
										showSentAt
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
