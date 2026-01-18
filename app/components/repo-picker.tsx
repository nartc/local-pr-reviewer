import { Button, Spinner, Text, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { VscRepo } from 'react-icons/vsc';

interface RepoPickerProps {
	onSelect: (path: string) => void;
	onCancel: () => void;
}

interface GitRepo {
	path: string;
	name: string;
}

export function RepoPicker({ onSelect, onCancel }: RepoPickerProps) {
	const [repos, setRepos] = useState<GitRepo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState('');

	useEffect(() => {
		fetch('/api/repos/scan')
			.then((res) => res.json())
			.then((data) => {
				if (data.error) {
					setError(data.error);
				} else {
					setRepos(data.repos);
				}
				setLoading(false);
			})
			.catch((err) => {
				setError(err.message);
				setLoading(false);
			});
	}, []);

	const filteredRepos = repos.filter(
		(repo) =>
			repo.name.toLowerCase().includes(filter.toLowerCase()) ||
			repo.path.toLowerCase().includes(filter.toLowerCase()),
	);

	return (
		<div className="flex flex-col h-full max-h-[60vh]">
			{/* Search input */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700">
				<TextField.Root
					placeholder="Filter repositories..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					autoFocus
				/>
			</div>

			{/* Repo list */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center p-8 gap-2">
						<Spinner size="2" />
						<Text size="2" color="gray">
							Scanning for repositories...
						</Text>
					</div>
				) : error ? (
					<div className="p-4">
						<Text size="2" color="red">
							{error}
						</Text>
					</div>
				) : filteredRepos.length === 0 ? (
					<div className="p-4 text-center">
						<Text size="2" color="gray">
							{filter
								? 'No repositories match your filter'
								: 'No repositories found'}
						</Text>
					</div>
				) : (
					<ul
						className="divide-y divide-gray-200 dark:divide-gray-700"
						role="listbox"
						aria-label="Available repositories"
					>
						{filteredRepos.map((repo) => (
							<li
								key={repo.path}
								role="option"
								aria-selected={false}
							>
								<button
									onClick={() => onSelect(repo.path)}
									className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
								>
									<VscRepo className="w-5 h-5 text-gray-400 shrink-0" />
									<div className="min-w-0">
										<Text
											size="2"
											weight="medium"
											className="truncate block"
										>
											{repo.name}
										</Text>
										<Text
											size="1"
											color="gray"
											className="truncate block"
										>
											{repo.path}
										</Text>
									</div>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* Footer */}
			<div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
				<Button variant="soft" color="gray" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</div>
	);
}
