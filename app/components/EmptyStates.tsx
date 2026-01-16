import type { ReactNode } from 'react';
import {
	VscComment,
	VscDiff,
	VscRepo,
	VscSearch,
	VscTerminal,
} from 'react-icons/vsc';

interface EmptyStateProps {
	icon: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
			<div className="text-gray-300 dark:text-gray-600 mb-4">{icon}</div>
			<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
				{title}
			</h3>
			{description && (
				<p className="text-sm text-gray-500 max-w-sm mb-4">
					{description}
				</p>
			)}
			{action}
		</div>
	);
}

export function EmptyRepos({ onAddRepo }: { onAddRepo?: () => void }) {
	return (
		<EmptyState
			icon={<VscRepo className="w-16 h-16" />}
			title="No repositories"
			description="Add a repository to start reviewing code changes."
			action={
				onAddRepo && (
					<button
						onClick={onAddRepo}
						className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
					>
						Add Repository
					</button>
				)
			}
		/>
	);
}

export function EmptyComments() {
	return (
		<EmptyState
			icon={<VscComment className="w-12 h-12" />}
			title="No comments yet"
			description="Click on a line in the diff to add a comment."
		/>
	);
}

export function EmptyQueuedComments() {
	return (
		<div className="text-center py-6 text-gray-500">
			<VscComment className="w-8 h-8 mx-auto mb-2 opacity-50" />
			<p className="text-sm">No queued comments</p>
		</div>
	);
}

export function EmptyStagedComments() {
	return (
		<div className="text-center py-6 text-gray-500">
			<VscComment className="w-8 h-8 mx-auto mb-2 opacity-50" />
			<p className="text-sm">No staged comments</p>
		</div>
	);
}

export function EmptyDiff({
	currentBranch,
	baseBranch,
}: {
	currentBranch: string;
	baseBranch: string;
}) {
	return (
		<EmptyState
			icon={<VscDiff className="w-16 h-16" />}
			title="No changes detected"
			description={`The branch "${currentBranch}" has no differences from "${baseBranch}".`}
		/>
	);
}

export function EmptyTmuxSessions() {
	return (
		<EmptyState
			icon={<VscTerminal className="w-12 h-12" />}
			title="No tmux sessions"
			description="Start a tmux session to send comments to your coding agent."
		/>
	);
}

export function EmptySearchResults({ query }: { query: string }) {
	return (
		<EmptyState
			icon={<VscSearch className="w-12 h-12" />}
			title="No results found"
			description={`No repositories match "${query}".`}
		/>
	);
}

export function NoChangesInFile({ fileName }: { fileName: string }) {
	return (
		<EmptyState
			icon={<VscDiff className="w-12 h-12" />}
			title="No changes in this file"
			description={`"${fileName}" has no modifications.`}
		/>
	);
}
