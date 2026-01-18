import { Button, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';
import { VscAdd, VscDiff, VscRepo } from 'react-icons/vsc';

interface EmptyStateProps {
	icon: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4 animate-fade-in-up">
			<div
				className="p-4 rounded-2xl"
				style={{ backgroundColor: 'var(--color-surface-hover)' }}
			>
				<div style={{ color: 'var(--color-text-muted)' }}>{icon}</div>
			</div>
			<div className="space-y-2">
				<Heading
					size="4"
					style={{ color: 'var(--color-text-primary)' }}
				>
					{title}
				</Heading>
				{description && (
					<Text
						size="2"
						className="max-w-sm block"
						style={{ color: 'var(--color-text-secondary)' }}
					>
						{description}
					</Text>
				)}
			</div>
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}

export function EmptyRepos({ onAddRepo }: { onAddRepo?: () => void }) {
	return (
		<EmptyState
			icon={<VscRepo className="w-12 h-12" />}
			title="No repositories yet"
			description="Add a repository to start reviewing LLM-generated code changes and collaborate with your coding assistant."
			action={
				onAddRepo && (
					<Button size="3" onClick={onAddRepo} className="btn-press">
						<VscAdd className="w-4 h-4" />
						Add Repository
					</Button>
				)
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
			icon={<VscDiff className="w-12 h-12" />}
			title="No changes detected"
			description={`The branch "${currentBranch}" has no differences from "${baseBranch}". Make some changes and come back to review them.`}
		/>
	);
}
