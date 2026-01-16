import * as Dialog from '@radix-ui/react-dialog';
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
			// Fetch available branches
			fetchBranches();
		}
	}, [open]);

	const fetchBranches = async () => {
		setLoading(true);
		try {
			// For now, use common branch names
			// In a full implementation, this would fetch from git
			setBranches(['main', 'master', 'develop', 'staging']);
		} catch (error) {
			console.error('Failed to fetch branches:', error);
		}
		setLoading(false);
	};

	const handleSave = () => {
		// Update the session's base branch
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
			<Dialog.Trigger asChild>
				<button
					className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
					title="Change base branch"
				>
					<VscSourceControl className="w-4 h-4" />
					<span>{currentBaseBranch}</span>
				</button>
			</Dialog.Trigger>

			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
				<Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-gray-900 rounded-lg shadow-xl z-50 p-6">
					<Dialog.Title className="text-lg font-semibold mb-4">
						Select Base Branch
					</Dialog.Title>

					<div className="space-y-2 mb-6">
						{loading ? (
							<div className="text-sm text-gray-500">
								Loading branches...
							</div>
						) : (
							branches.map((branch) => (
								<button
									key={branch}
									onClick={() => setSelectedBranch(branch)}
									className={`w-full px-3 py-2 text-left rounded flex items-center justify-between transition-colors ${
										selectedBranch === branch
											? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
											: 'hover:bg-gray-100 dark:hover:bg-gray-800'
									}`}
								>
									<span className="text-sm">{branch}</span>
									{selectedBranch === branch && (
										<VscCheck className="w-4 h-4" />
									)}
								</button>
							))
						)}
					</div>

					{/* Custom branch input */}
					<div className="mb-6">
						<label className="block text-sm font-medium mb-2">
							Or enter a custom branch:
						</label>
						<input
							type="text"
							value={selectedBranch}
							onChange={(e) => setSelectedBranch(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="branch-name"
						/>
					</div>

					<div className="flex justify-end gap-2">
						<Dialog.Close asChild>
							<button className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
								Cancel
							</button>
						</Dialog.Close>
						<button
							onClick={handleSave}
							disabled={!selectedBranch}
							className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
						>
							Apply
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
