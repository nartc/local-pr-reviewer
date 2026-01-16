import { useEffect, useState } from 'react';
import { VscLoading, VscRepo } from 'react-icons/vsc';

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
				<input
					type="text"
					placeholder="Filter repositories..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
					autoFocus
				/>
			</div>

			{/* Repo list */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center p-8">
						<VscLoading className="w-6 h-6 animate-spin text-gray-400" />
						<span className="ml-2 text-gray-500">
							Scanning for repositories...
						</span>
					</div>
				) : error ? (
					<div className="p-4 text-red-500">{error}</div>
				) : filteredRepos.length === 0 ? (
					<div className="p-4 text-gray-500 text-center">
						{filter
							? 'No repositories match your filter'
							: 'No repositories found'}
					</div>
				) : (
					<ul className="divide-y divide-gray-200 dark:divide-gray-700">
						{filteredRepos.map((repo) => (
							<li key={repo.path}>
								<button
									onClick={() => onSelect(repo.path)}
									className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
								>
									<VscRepo className="w-5 h-5 text-gray-400 shrink-0" />
									<div className="min-w-0">
										<div className="font-medium truncate">
											{repo.name}
										</div>
										<div className="text-sm text-gray-500 truncate">
											{repo.path}
										</div>
									</div>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* Footer */}
			<div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
				<button
					onClick={onCancel}
					className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}
