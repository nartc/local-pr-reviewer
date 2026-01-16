import { Dialog } from '@radix-ui/themes';
import { useCallback, useState } from 'react';
import { VscAdd, VscArrowRight, VscRepo, VscTrash } from 'react-icons/vsc';
import { Form, redirect, useFetcher, useLoaderData } from 'react-router';
import { EmptyRepos } from '../components/EmptyStates';
import { SimpleLayout } from '../components/Layout';
import { RepoPicker } from '../components/RepoPicker';
import { repoService, type RepoWithPath } from '../services/repo.service';
import type { Route } from './+types/home';

export function meta() {
	return [
		{ title: 'PR Reviewer' },
		{ name: 'description', content: 'Review LLM-generated code commits' },
	];
}

export async function loader() {
	const repos = repoService.getAllRepos();
	return { repos };
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'add') {
		const path = formData.get('path') as string;
		if (!path) {
			return { error: 'Path is required' };
		}

		try {
			const { repo } = await repoService.createOrGetRepoFromPath(path);
			// Get or create session and redirect to review page
			const session = await repoService.getOrCreateSession(repo.id, path);
			return redirect(
				`/review/${session.id}?path=${encodeURIComponent(path)}`,
			);
		} catch (error) {
			return {
				error:
					error instanceof Error
						? error.message
						: 'Failed to add repository',
			};
		}
	}

	if (intent === 'delete') {
		const repoId = formData.get('repoId') as string;
		if (repoId) {
			repoService.deleteRepo(repoId);
		}
		return { success: true };
	}

	if (intent === 'open') {
		const repoId = formData.get('repoId') as string;
		const path = formData.get('path') as string;
		if (repoId && path) {
			const session = await repoService.getOrCreateSession(repoId, path);
			return redirect(
				`/review/${session.id}?path=${encodeURIComponent(path)}`,
			);
		}
		return { error: 'Missing repo or path' };
	}

	return { error: 'Unknown action' };
}

export default function Home() {
	const { repos } = useLoaderData<typeof loader>();
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const fetcher = useFetcher();

	const handleSelectRepo = useCallback(
		(path: string) => {
			setIsAddModalOpen(false);
			fetcher.submit(
				{ intent: 'add', path },
				{ method: 'POST', action: '/?index' },
			);
		},
		[fetcher],
	);

	const handleOpenModal = useCallback(() => {
		setIsAddModalOpen(true);
	}, []);

	const handleCloseModal = useCallback(() => {
		setIsAddModalOpen(false);
	}, []);

	return (
		<SimpleLayout>
			<div className="max-w-4xl mx-auto p-8">
				<div className="flex items-center justify-between mb-8">
					<h2 className="text-2xl font-bold">Repositories</h2>
					<button
						onClick={handleOpenModal}
						className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
					>
						<VscAdd className="w-4 h-4" />
						Add Repository
					</button>
				</div>

				{repos.length === 0 ? (
					<EmptyRepos onAddRepo={handleOpenModal} />
				) : (
					<div className="space-y-4">
						{repos.map((repo) => (
							<RepoCard key={repo.id} repo={repo} />
						))}
					</div>
				)}
			</div>

			{/* Add Repository Modal */}
			<Dialog.Root open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
				<Dialog.Content className="max-w-2xl">
					<Dialog.Title>Add Repository</Dialog.Title>
					<RepoPicker
						onSelect={handleSelectRepo}
						onCancel={handleCloseModal}
					/>
				</Dialog.Content>
			</Dialog.Root>
		</SimpleLayout>
	);
}

function RepoCard({ repo }: { repo: RepoWithPath }) {
	const primaryPath = repo.paths[0]?.path;

	return (
		<div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-3">
					<VscRepo className="w-6 h-6 text-gray-400" />
					<div>
						<h3 className="font-semibold">{repo.name}</h3>
						<p className="text-sm text-gray-500">
							{repo.remote_url || 'No remote'}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{primaryPath && (
						<Form method="POST" action="/?index">
							<input type="hidden" name="intent" value="open" />
							<input
								type="hidden"
								name="repoId"
								value={repo.id}
							/>
							<input
								type="hidden"
								name="path"
								value={primaryPath}
							/>
							<button
								type="submit"
								className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
							>
								Open
								<VscArrowRight className="w-4 h-4" />
							</button>
						</Form>
					)}
					<Form method="POST" action="/?index">
						<input type="hidden" name="intent" value="delete" />
						<input type="hidden" name="repoId" value={repo.id} />
						<button
							type="submit"
							className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
							title="Delete repository"
						>
							<VscTrash className="w-4 h-4" />
						</button>
					</Form>
				</div>
			</div>

			{repo.paths.length > 1 && (
				<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
					<p className="text-xs text-gray-500 mb-2">
						Paths ({repo.paths.length})
					</p>
					<div className="space-y-1">
						{repo.paths.map((p) => (
							<div
								key={p.id}
								className="text-sm text-gray-600 dark:text-gray-400 truncate"
							>
								{p.path}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
