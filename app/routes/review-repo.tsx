// Route for handling /review?repo=/path/to/repo
// This route looks up or creates a session for the repo and handles signal file setup

import { Button, Dialog, Flex, Text } from '@radix-ui/themes';
import { Effect } from 'effect';
import { useState } from 'react';
import { redirect, useFetcher, useLoaderData, useNavigate } from 'react-router';
import { Layout } from '../components/layout';
import { runtime } from '../lib/effect-runtime';
import { checkSignalFileStatus } from '../lib/signal-file.server';
import { GitService } from '../services/git.service';
import { RepoService } from '../services/repo.service';
import type { Route } from './+types/review-repo';

export function meta() {
	return [{ title: 'Review - PR Reviewer' }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const repoPath = url.searchParams.get('repo');

	if (!repoPath) {
		throw redirect('/');
	}

	// Check if this is a valid git repository
	const isGitRepo = await runtime.runPromise(
		Effect.gen(function* () {
			const git = yield* GitService;
			return yield* git
				.isGitRepo(repoPath)
				.pipe(Effect.catchAll(() => Effect.succeed(false)));
		}),
	);

	if (!isGitRepo) {
		throw new Response('Not a git repository', { status: 400 });
	}

	// Try to find existing repo and session, or create them
	const result = await runtime.runPromise(
		Effect.gen(function* () {
			const repoService = yield* RepoService;

			// This will create the repo if it doesn't exist
			const { repo, isNew } =
				yield* repoService.createOrGetRepoFromPath(repoPath);

			// Get or create session for this repo
			const session = yield* repoService.getOrCreateSession(
				repo.id,
				repoPath,
			);

			return { repo, session, isNew };
		}),
	);

	// Check signal file status
	const signalStatus = await runtime.runPromise(
		checkSignalFileStatus(repoPath),
	);

	// If signal file exists or auto-confirm is enabled, redirect to review
	if (signalStatus.exists || signalStatus.autoConfirm) {
		// If auto-confirm, we need to set up the signal file first
		if (!signalStatus.exists && signalStatus.autoConfirm) {
			// Will be handled client-side
			throw redirect(
				`/review/${result.session.id}?path=${encodeURIComponent(repoPath)}&setupSignal=true`,
			);
		}
		throw redirect(
			`/review/${result.session.id}?path=${encodeURIComponent(repoPath)}`,
		);
	}

	return {
		repoPath,
		repoName: result.repo.name,
		sessionId: result.session.id,
		signalFileExists: signalStatus.exists,
		autoConfirmEnabled: signalStatus.autoConfirm,
	};
}

export default function ReviewRepo() {
	const { repoPath, repoName, sessionId, signalFileExists } =
		useLoaderData<typeof loader>();

	const navigate = useNavigate();
	const fetcher = useFetcher();
	const [showDialog, setShowDialog] = useState(!signalFileExists);

	const handleConfirm = (remember: boolean) => {
		fetcher.submit(
			{ repoPath, remember: remember.toString() },
			{ method: 'POST', action: '/api/setup-signal' },
		);
		setShowDialog(false);

		// Navigate to the review page after setup
		navigate(`/review/${sessionId}?path=${encodeURIComponent(repoPath)}`);
	};

	const handleCancel = () => {
		setShowDialog(false);
		// Continue without signal file
		navigate(`/review/${sessionId}?path=${encodeURIComponent(repoPath)}`);
	};

	return (
		<Layout
			header={
				<div className="flex items-center gap-4 text-sm">
					<Text weight="medium">{repoName}</Text>
				</div>
			}
		>
			<div className="flex items-center justify-center h-full">
				<Dialog.Root open={showDialog} onOpenChange={setShowDialog}>
					<Dialog.Content maxWidth="500px">
						<Dialog.Title>
							Enable Watch Comments Feature
						</Dialog.Title>
						<Dialog.Description size="2" mb="4">
							To enable real-time comment notifications, we need
							to:
						</Dialog.Description>

						<div className="space-y-2 mb-4">
							<Text as="p" size="2">
								1. Create{' '}
								<code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
									.local-pr-reviewer-pending
								</code>{' '}
								file in your repo
							</Text>
							<Text as="p" size="2">
								2. Add it to your{' '}
								<code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
									.gitignore
								</code>
							</Text>
						</div>

						<Text as="p" size="2" color="gray" mb="4">
							Without this, you can still manually check for
							comments using the{' '}
							<code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
								check_pr_comments
							</code>{' '}
							tool.
						</Text>

						<Flex gap="3" mt="4" justify="end">
							<Button
								variant="soft"
								color="gray"
								onClick={handleCancel}
							>
								Cancel
							</Button>
							<Button
								variant="soft"
								onClick={() => handleConfirm(false)}
							>
								Confirm
							</Button>
							<Button onClick={() => handleConfirm(true)}>
								Confirm & Remember
							</Button>
						</Flex>
					</Dialog.Content>
				</Dialog.Root>

				{!showDialog && <Text color="gray">Redirecting...</Text>}
			</div>
		</Layout>
	);
}
