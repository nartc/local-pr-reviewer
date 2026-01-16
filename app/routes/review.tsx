import { useState } from 'react';
import { VscArrowLeft } from 'react-icons/vsc';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { BaseBranchSelector } from '../components/BaseBranchSelector';
import { CommentQueue } from '../components/CommentQueue';
import { DiffViewer } from '../components/DiffViewer';
import { EmptyDiff } from '../components/EmptyStates';
import { FileExplorer, type DiffFile } from '../components/FileExplorer';
import { Layout } from '../components/Layout';
import { SettingsModal } from '../components/SettingsModal';
import { commentService, type Comment } from '../services/comment.service';
import { createGitService } from '../services/git.service';
import { repoService } from '../services/repo.service';
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

	const sessionData = repoService.getSessionWithRepo(sessionId);
	if (!sessionData) {
		throw new Response('Session not found', { status: 404 });
	}

	const { session, repo } = sessionData;
	const repoPath = path || repo.paths?.[0]?.path;

	if (!repoPath) {
		throw new Response('No repository path available', { status: 400 });
	}

	// Get the base branch (session override or repo default)
	const baseBranch = session.base_branch || repo.base_branch;

	// Get diff
	const git = createGitService();
	let files: DiffFile[] = [];
	let rawDiff = '';

	try {
		const diffSummary = await git.getDiffSummary(repoPath, baseBranch);
		rawDiff = await git.getDiff(repoPath, baseBranch);

		files = diffSummary.files.map((file) => {
			const isBinary = !('insertions' in file);
			return {
				path: file.file,
				status: isBinary
					? ('modified' as const)
					: file.insertions > 0 && file.deletions === 0
						? ('added' as const)
						: file.deletions > 0 && file.insertions === 0
							? ('deleted' as const)
							: ('modified' as const),
				additions: isBinary ? 0 : file.insertions,
				deletions: isBinary ? 0 : file.deletions,
			};
		});
	} catch (error) {
		console.error('Failed to get diff:', error);
	}

	const currentBranch = await git.getCurrentBranch(repoPath);

	// Get comments
	const queuedComments = commentService.getQueuedComments(sessionId);
	const stagedComments = commentService.getStagedComments(sessionId);
	const sentComments = commentService.getSentComments(sessionId);

	return {
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
	};
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

	const handleSendNow = async (comment: Comment) => {
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
	};

	const handleSendNowFromDiff = async (
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
	};

	const handleSendAllStaged = async () => {
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
	};

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
					onBranchChange={() => revalidator.revalidate()}
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
			onSelectFile={setSelectedFile}
		/>
	);

	const rightSidebar = (
		<CommentQueue
			sessionId={session.id}
			queuedComments={queuedComments}
			stagedComments={stagedComments}
			sentComments={sentComments}
			selectedTmuxSession={selectedTmuxSession}
			onSelectTmuxSession={setSelectedTmuxSession}
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
				/>
			)}
		</Layout>
	);
}
