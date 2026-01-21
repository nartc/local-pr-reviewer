import { Button, Spinner, Text, TextField } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';
import { VscRepo } from 'react-icons/vsc';

interface RepoPickerProps {
	onSelect: (path: string) => void;
	onCancel: () => void;
}

interface GitRepo {
	path: string;
	name: string;
}

interface StreamMessage {
	type: 'repo' | 'done' | 'error';
	data?: GitRepo;
	total?: number;
	message?: string;
}

export function RepoPicker({ onSelect, onCancel }: RepoPickerProps) {
	const [repos, setRepos] = useState<GitRepo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState('');
	const abortControllerRef = useRef<AbortController | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		abortControllerRef.current = controller;

		async function streamRepos() {
			try {
				const response = await fetch('/api/repos/scan', {
					signal: controller.signal,
				});

				if (!response.ok) {
					throw new Error(`HTTP error ${response.status}`);
				}

				const reader = response.body?.getReader();
				if (!reader) {
					throw new Error('No response body');
				}

				const decoder = new TextDecoder();
				let buffer = '';
				const seenPaths = new Set<string>();

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					// Keep the last potentially incomplete line in buffer
					buffer = lines.pop() || '';

					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const message: StreamMessage = JSON.parse(line);
							if (message.type === 'repo' && message.data) {
								// Deduplicate repos by path
								if (!seenPaths.has(message.data.path)) {
									seenPaths.add(message.data.path);
									setRepos((prev) => {
										const next = [...prev, message.data!];
										// Keep sorted by name
										next.sort((a, b) =>
											a.name.localeCompare(b.name),
										);
										return next;
									});
								}
							} else if (message.type === 'error') {
								setError(
									message.message ||
										'Failed to scan repositories',
								);
							} else if (message.type === 'done') {
								setLoading(false);
							}
						} catch {
							// Ignore malformed JSON lines
						}
					}
				}

				// Process any remaining buffer
				if (buffer.trim()) {
					try {
						const message: StreamMessage = JSON.parse(buffer);
						if (message.type === 'done') {
							setLoading(false);
						}
					} catch {
						// Ignore
					}
				}

				setLoading(false);
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') {
					return; // Cancelled, don't update state
				}
				setError(err instanceof Error ? err.message : 'Unknown error');
				setLoading(false);
			}
		}

		streamRepos();

		return () => {
			controller.abort();
		};
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
				{loading && repos.length > 0 && (
					<div className="flex items-center gap-2 mt-2">
						<Spinner size="1" />
						<Text size="1" color="gray">
							Found {repos.length} repositories, still scanning...
						</Text>
					</div>
				)}
			</div>

			{/* Repo list */}
			<div className="flex-1 overflow-y-auto">
				{loading && repos.length === 0 ? (
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
								<Button
									variant="ghost"
									onClick={() => onSelect(repo.path)}
									className="w-full justify-start px-4 py-3 h-auto"
								>
									<VscRepo className="w-5 h-5 text-gray-400 shrink-0" />
									<div className="min-w-0 flex flex-col items-start gap-0.5">
										<Text size="2" weight="medium" truncate>
											{repo.name}
										</Text>
										<Text size="1" color="gray" truncate>
											{repo.path}
										</Text>
									</div>
								</Button>
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
