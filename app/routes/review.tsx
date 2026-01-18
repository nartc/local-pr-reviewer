import { Effect } from 'effect';
import { useCallback, useRef, useState } from 'react';
import { VscArrowLeft } from 'react-icons/vsc';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { BaseBranchSelector } from '../components/base-branch-selector';
import { CommentQueue } from '../components/comment-queue';
import { DiffViewer } from '../components/diff-viewer';
import { EmptyDiff } from '../components/empty-states';
import { FileExplorer, type DiffFile } from '../components/file-explorer';
import { Layout } from '../components/layout';
import { SettingsModal } from '../components/settings-modal';
import { runtime } from '../lib/effect-runtime';
import { CommentService, type Comment } from '../services/comment.service';
import { GitService } from '../services/git.service';
import { RepoService } from '../services/repo.service';
import type { Route } from './+types/review';

type DiffStyle = 'split' | 'unified';

export function meta({ data }: Route.MetaArgs) {
	const repoName = data?.repo?.name || 'Review';
	return [{ title: `${repoName} - PR Reviewer` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
	const { sessionId } = params;
	const url = new URL(request.url);
	const path = url.searchParams.get('path');

	if (!sessionId) {
		throw new Response('Session ID required', { status: 400 });
	}

	return runtime.runPromise(
		Effect.gen(function* () {
			const repo = yield* RepoService;
			const git = yield* GitService;
			const comments = yield* CommentService;

			const { session, repo: repoData } =
				yield* repo.getSessionWithRepo(sessionId);

			const repoPath = path || repoData.paths?.[0]?.path;

			if (!repoPath) {
				throw new Response('No repository path available', {
					status: 400,
				});
			}

			// Get the base branch (session override or repo default)
			const baseBranch = session.base_branch || repoData.base_branch;

			// Get diff and current branch in parallel
			let files: DiffFile[] = [];
			let rawDiff = '';
			let currentBranch = '';

			const [diffResult, branch] = yield* Effect.all([
				git
					.getDiff(repoPath, baseBranch)
					.pipe(
						Effect.catchAll(() =>
							Effect.succeed({ files: [], rawDiff: '' }),
						),
					),
				git
					.getCurrentBranch(repoPath)
					.pipe(Effect.catchAll(() => Effect.succeed('unknown'))),
			]);

			rawDiff = diffResult.rawDiff;
			currentBranch = branch;

			files = diffResult.files.map((file) => ({
				path: file.path,
				status: file.status,
				additions: file.additions,
				deletions: file.deletions,
			}));

			// Get comments by status
			const [
				queuedComments,
				stagedComments,
				sentComments,
				resolvedComments,
			] = yield* Effect.all([
				comments.getQueuedComments(sessionId),
				comments.getStagedComments(sessionId),
				comments.getSentComments(sessionId),
				comments.getResolvedComments(sessionId),
			]);

			return {
				session,
				repo: repoData,
				repoPath,
				baseBranch,
				currentBranch,
				files,
				rawDiff,
				queuedComments,
				stagedComments,
				sentComments,
				resolvedComments,
			};
		}),
	);
}

export default function Review() {
	const {
		session,
		repo,
		repoPath,
		baseBranch,
		currentBranch,
		files,
		rawDiff,
		queuedComments,
		stagedComments,
		sentComments,
		resolvedComments,
	} = useLoaderData<typeof loader>();
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [diffStyle, setDiffStyle] = useState<DiffStyle>('split');
	const revalidator = useRevalidator();

	// Ref to scroll to file in virtualized diff viewer
	const scrollToFileRef = useRef<((filePath: string) => void) | null>(null);

	const handleSelectFile = useCallback((filePath: string) => {
		setSelectedFile(filePath);
		// Scroll to and expand the file in the diff viewer
		scrollToFileRef.current?.(filePath);
	}, []);

	const handleSendNow = useCallback(
		async (comment: Comment) => {
			try {
				const formData = new URLSearchParams();
				formData.append('intent', 'send');
				formData.append('commentIds', comment.id);

				await fetch('/api/send', {
					method: 'POST',
					body: formData,
				});
				revalidator.revalidate();
			} catch (error) {
				console.error('Failed to send comment:', error);
			}
		},
		[revalidator],
	);

	const handleSendNowFromDiff = useCallback(
		async (
			content: string,
			filePath: string,
			lineStart?: number,
			lineEnd?: number,
		) => {
			try {
				// First create the comment, then send it
				const createFormData = new URLSearchParams();
				createFormData.append('intent', 'create');
				createFormData.append('sessionId', session.id);
				createFormData.append('filePath', filePath);
				createFormData.append('content', content);
				if (lineStart)
					createFormData.append('lineStart', lineStart.toString());
				if (lineEnd)
					createFormData.append('lineEnd', lineEnd.toString());

				const createResponse = await fetch('/api/comments', {
					method: 'POST',
					body: createFormData,
				});
				const createResult = await createResponse.json();

				if (createResult.comment?.id) {
					// Now send the comment
					const sendFormData = new URLSearchParams();
					sendFormData.append('intent', 'send');
					sendFormData.append('commentIds', createResult.comment.id);

					await fetch('/api/send', {
						method: 'POST',
						body: sendFormData,
					});
				}

				revalidator.revalidate();
			} catch (error) {
				console.error('Failed to send comment:', error);
			}
		},
		[session.id, revalidator],
	);

	const handleSendAllStaged = useCallback(async () => {
		if (stagedComments.length === 0) return;

		try {
			const formData = new URLSearchParams();
			formData.append('intent', 'send');
			stagedComments.forEach((c) => formData.append('commentIds', c.id));

			await fetch('/api/send', {
				method: 'POST',
				body: formData,
			});
			revalidator.revalidate();
		} catch (error) {
			console.error('Failed to send comments:', error);
		}
	}, [stagedComments, revalidator]);

	const handleProcessComments = useCallback(async (commentIds: string[]) => {
		if (commentIds.length === 0) return null;

		try {
			const formData = new URLSearchParams();
			formData.append('intent', 'process');
			commentIds.forEach((id) => formData.append('commentIds', id));

			const response = await fetch('/api/process', {
				method: 'POST',
				body: formData,
			});

			const result = await response.json();
			if (result.error) {
				console.error('Failed to process comments:', result.error);
				return null;
			}

			return result.processedText as string;
		} catch (error) {
			console.error('Failed to process comments:', error);
			return null;
		}
	}, []);

	const handleBranchChange = useCallback(() => {
		revalidator.revalidate();
	}, [revalidator]);

	const header = (
		<div className="flex items-center gap-4 text-sm">
			<Link
				to="/"
				className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
			>
				<VscArrowLeft className="w-4 h-4" />
				Back
			</Link>
			<span className="text-gray-300 dark:text-gray-600">|</span>
			<span className="font-medium">{repo.name}</span>
			<div className="flex items-center gap-1 text-gray-500">
				<span>{currentBranch}</span>
				<span className="text-gray-400">vs</span>
				<BaseBranchSelector
					currentBaseBranch={baseBranch}
					repoId={repo.id}
					sessionId={session.id}
					onBranchChange={handleBranchChange}
				/>
			</div>
		</div>
	);

	const headerActions = (
		<SettingsModal diffStyle={diffStyle} onDiffStyleChange={setDiffStyle} />
	);

	const leftSidebar = (
		<FileExplorer
			files={files}
			selectedFile={selectedFile}
			onSelectFile={handleSelectFile}
		/>
	);

	const rightSidebar = (
		<CommentQueue
			sessionId={session.id}
			queuedComments={queuedComments}
			stagedComments={stagedComments}
			sentComments={sentComments}
			resolvedComments={resolvedComments}
			onSendNow={handleSendNow}
			onSendAllStaged={handleSendAllStaged}
			onProcessComments={handleProcessComments}
		/>
	);

	return (
		<Layout
			header={header}
			headerActions={headerActions}
			leftSidebar={leftSidebar}
			rightSidebar={rightSidebar}
		>
			{files.length === 0 ? (
				<EmptyDiff
					currentBranch={currentBranch}
					baseBranch={baseBranch}
				/>
			) : (
				<DiffViewer
					rawDiff={rawDiff}
					className="h-full"
					diffStyle={diffStyle}
					selectedFile={selectedFile}
					sessionId={session.id}
					onSendNow={handleSendNowFromDiff}
					scrollToFileRef={scrollToFileRef}
				/>
			)}
		</Layout>
	);
}
