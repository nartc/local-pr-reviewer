import { Button, Dialog, Spinner, Text, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { VscCheck, VscSourceControl } from 'react-icons/vsc';
import { useFetcher } from 'react-router';

interface BaseBranchSelectorProps {
	currentBaseBranch: string;
	repoId: string;
	sessionId: string;
	onBranchChange?: (branch: string) => void;
}

export function BaseBranchSelector({
	currentBaseBranch,
	repoId,
	sessionId,
	onBranchChange,
}: BaseBranchSelectorProps) {
	const [open, setOpen] = useState(false);
	const [branches, setBranches] = useState<string[]>([]);
	const [selectedBranch, setSelectedBranch] = useState(currentBaseBranch);
	const [loading, setLoading] = useState(false);
	const fetcher = useFetcher();

	useEffect(() => {
		if (open) {
			fetchBranches();
		}
	}, [open]);

	const fetchBranches = async () => {
		setLoading(true);
		try {
			setBranches(['main', 'master', 'develop', 'staging']);
		} catch (error) {
			console.error('Failed to fetch branches:', error);
		}
		setLoading(false);
	};

	const handleSave = () => {
		fetcher.submit(
			{
				intent: 'updateBaseBranch',
				sessionId,
				baseBranch: selectedBranch,
			},
			{ method: 'POST', action: '/api/repos' },
		);
		onBranchChange?.(selectedBranch);
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger>
				<button
					className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
					aria-label={`Change base branch (currently ${currentBaseBranch})`}
				>
					<VscSourceControl aria-hidden="true" />
					<span>{currentBaseBranch}</span>
				</button>
			</Dialog.Trigger>

			<Dialog.Content maxWidth="350px">
				<Dialog.Title>Select Base Branch</Dialog.Title>

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Spinner size="3" />
					</div>
				) : (
					<div
						className="space-y-2 my-4"
						role="radiogroup"
						aria-label="Select base branch"
					>
						{branches.map((branch) => (
							<button
								key={branch}
								onClick={() => setSelectedBranch(branch)}
								role="radio"
								aria-checked={selectedBranch === branch}
								className={`w-full px-3 py-2 text-left rounded flex items-center justify-between transition-colors ${
									selectedBranch === branch
										? 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
										: 'hover:bg-gray-100 dark:hover:bg-gray-800'
								}`}
							>
								<Text size="2">{branch}</Text>
								{selectedBranch === branch && (
									<VscCheck aria-hidden="true" />
								)}
							</button>
						))}
					</div>
				)}

				{/* Custom branch input */}
				<div className="mb-4">
					<Text size="2" weight="medium" className="mb-2 block">
						Or enter a custom branch:
					</Text>
					<TextField.Root
						value={selectedBranch}
						onChange={(e) => setSelectedBranch(e.target.value)}
						placeholder="branch-name"
					/>
				</div>

				<div className="flex justify-end gap-2">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							Cancel
						</Button>
					</Dialog.Close>
					<Button onClick={handleSave} disabled={!selectedBranch}>
						Apply
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
