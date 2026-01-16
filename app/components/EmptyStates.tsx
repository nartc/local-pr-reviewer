import { Button, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';
import { VscDiff, VscRepo } from 'react-icons/vsc';

interface EmptyStateProps {
	icon: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-1">
			<div className="text-gray-300 dark:text-gray-600">{icon}</div>
			<Heading size="4">{title}</Heading>
			{description && (
				<Text size="2" color="gray" className="max-w-sm">
					{description}
				</Text>
			)}
			{action && <div className="mt-4">{action}</div>}
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
				onAddRepo && <Button onClick={onAddRepo}>Add Repository</Button>
			}
		/>
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
