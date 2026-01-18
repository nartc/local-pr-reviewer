import { Effect } from 'effect';
import { useCallback, useRef, useState } from 'react';
import { VscArrowLeft } from 'react-icons/vsc';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { BaseBranchSelector } from '../components/BaseBranchSelector';
import { CommentQueue } from '../components/CommentQueue';
import { DiffViewer } from '../components/DiffViewer';
import { EmptyDiff } from '../components/EmptyStates';
import { FileExplorer, type DiffFile } from '../components/FileExplorer';
import { Layout } from '../components/Layout';
import { SettingsModal } from '../components/SettingsModal';
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

			// Get comments in parallel
			const [queuedComments, stagedComments, sentComments] =
				yield* Effect.all([
					comments.getQueuedComments(sessionId),
					comments.getStagedComments(sessionId),
					comments.getSentComments(sessionId),
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
	} = useLoaderData<typeof loader>();
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [selectedTmuxSession, setSelectedTmuxSession] = useState<
		string | null
	>(null);
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
			if (!selectedTmuxSession) return;

			try {
				await fetch('/api/send', {
					method: 'POST',
					body: new URLSearchParams({
						intent: 'sendOne',
						sessionName: selectedTmuxSession,
						commentId: comment.id,
					}),
				});
				revalidator.revalidate();
			} catch (error) {
				console.error('Failed to send comment:', error);
			}
		},
		[selectedTmuxSession, revalidator],
	);

	const handleSendNowFromDiff = useCallback(
		async (
			content: string,
			filePath: string,
			lineStart?: number,
			lineEnd?: number,
		) => {
			if (!selectedTmuxSession) {
				alert('Please select a tmux session first');
				return;
			}

			try {
				// Format the comment with file/line context
				const lineInfo = lineStart
					? lineEnd && lineEnd !== lineStart
						? `Lines ${lineStart}-${lineEnd}`
						: `Line ${lineStart}`
					: null;
				const formattedContent = lineInfo
					? `[${filePath} ${lineInfo}]\n${content}`
					: `[${filePath}]\n${content}`;

				const params = new URLSearchParams({
					intent: 'sendRaw',
					sessionName: selectedTmuxSession,
					content: formattedContent,
					sessionId: session.id,
					filePath,
				});
				if (lineStart) params.append('lineStart', lineStart.toString());
				if (lineEnd) params.append('lineEnd', lineEnd.toString());

				await fetch('/api/send', {
					method: 'POST',
					body: params,
				});
				revalidator.revalidate();
			} catch (error) {
				console.error('Failed to send comment:', error);
			}
		},
		[selectedTmuxSession, session.id, revalidator],
	);

	const handleSendAllStaged = useCallback(async () => {
		if (!selectedTmuxSession || stagedComments.length === 0) return;

		try {
			const formData = new URLSearchParams();
			formData.append('intent', 'sendMany');
			formData.append('sessionName', selectedTmuxSession);
			stagedComments.forEach((c) => formData.append('commentIds', c.id));

			await fetch('/api/send', {
				method: 'POST',
				body: formData,
			});
			revalidator.revalidate();
		} catch (error) {
			console.error('Failed to send comments:', error);
		}
	}, [selectedTmuxSession, stagedComments, revalidator]);

	const handleSelectTmuxSession = useCallback((sessionName: string) => {
		setSelectedTmuxSession(sessionName);
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
			selectedTmuxSession={selectedTmuxSession}
			onSelectTmuxSession={handleSelectTmuxSession}
			onSendNow={handleSendNow}
			onSendAllStaged={handleSendAllStaged}
			repoPath={repoPath}
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
