import { Button, Spinner, Text, TextField } from '@radix-ui/themes';
import { useEffect, useReducer, useRef } from 'react';
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

interface RepoPickerState {
	repos: GitRepo[];
	loading: boolean;
	error: string | null;
	filter: string;
}

type RepoPickerAction =
	| { type: 'ADD_REPO'; repo: GitRepo }
	| { type: 'SET_LOADING'; loading: boolean }
	| { type: 'SET_ERROR'; error: string | null }
	| { type: 'SET_FILTER'; filter: string };

const initialState: RepoPickerState = {
	repos: [],
	loading: true,
	error: null,
	filter: '',
};

function repoPickerReducer(
	state: RepoPickerState,
	action: RepoPickerAction,
): RepoPickerState {
	switch (action.type) {
		case 'ADD_REPO': {
			// Insert in sorted order
			const next = [...state.repos, action.repo];
			next.sort((a, b) => a.name.localeCompare(b.name));
			return { ...state, repos: next };
		}
		case 'SET_LOADING':
			return { ...state, loading: action.loading };
		case 'SET_ERROR':
			return { ...state, error: action.error };
		case 'SET_FILTER':
			return { ...state, filter: action.filter };
		default:
			return state;
	}
}

export function RepoPicker({ onSelect, onCancel }: RepoPickerProps) {
	const [state, dispatch] = useReducer(repoPickerReducer, initialState);
	const { repos, loading, error, filter } = state;
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
									dispatch({
										type: 'ADD_REPO',
										repo: message.data,
									});
								}
							} else if (message.type === 'error') {
								dispatch({
									type: 'SET_ERROR',
									error:
										message.message ||
										'Failed to scan repositories',
								});
							} else if (message.type === 'done') {
								dispatch({
									type: 'SET_LOADING',
									loading: false,
								});
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
							dispatch({ type: 'SET_LOADING', loading: false });
						}
					} catch {
						// Ignore
					}
				}

				dispatch({ type: 'SET_LOADING', loading: false });
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') {
					return; // Cancelled, don't update state
				}
				dispatch({
					type: 'SET_ERROR',
					error: err instanceof Error ? err.message : 'Unknown error',
				});
				dispatch({ type: 'SET_LOADING', loading: false });
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
					onChange={(e) =>
						dispatch({ type: 'SET_FILTER', filter: e.target.value })
					}
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
								onClick={() => onSelect(repo.path)}
								className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								<VscRepo className="w-5 h-5 text-gray-400 shrink-0" />
								<div className="min-w-0 flex flex-col gap-0.5">
									<Text size="2" weight="medium" truncate>
										{repo.name}
									</Text>
									<Text size="1" color="gray" truncate>
										{repo.path}
									</Text>
								</div>
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
