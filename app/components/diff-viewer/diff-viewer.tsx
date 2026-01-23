import type { AnnotationSide, Hunk } from '@pierre/diffs';
import { Button, Spinner, Text, Tooltip } from '@radix-ui/themes';
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react';
import { VscCollapseAll } from 'react-icons/vsc';
import { useTheme } from '../../lib/theme';
import { InlineCommentForm } from '../inline-comment-form';
import {
	DEFAULT_EXPANDED_COUNT,
	DEFAULT_LARGE_FILE_THRESHOLD,
} from './constants';
import { StickyFileHeader } from './file-header';
import { FileDiffWrapper } from './file-wrapper';
import { diffViewerReducer, initialDiffViewerState } from './reducer';
import type {
	CommentIndicatorAnnotation,
	DiffComponentsType,
	DiffViewerProps,
	HoveredLineResult,
	SelectedLineRange,
} from './types';
import {
	buildCommentMap,
	getActualChangedLineRange,
	shouldAutoCollapseFile,
} from './utils';

function DiffViewerClient({
	rawDiff,
	className,
	diffStyle = 'split',
	selectedFile,
	sessionId,
	files = [],
	largeFileThreshold = DEFAULT_LARGE_FILE_THRESHOLD,
	existingComments = [],
	onSendNow,
	onCommentChange,
	scrollToFileRef,
}: Omit<DiffViewerProps, 'onFileVisible'>) {
	const { resolvedTheme } = useTheme();
	const parentRef = useRef<HTMLDivElement>(null);
	const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const [state, dispatch] = useReducer(
		diffViewerReducer,
		initialDiffViewerState,
	);
	const {
		commentForm,
		selectedLines,
		expandedFiles,
		isInitialized,
		loadedFiles,
	} = state;

	// Build comment map for quick lookup by file and line
	const commentMap = useMemo(
		() => buildCommentMap(existingComments),
		[existingComments],
	);

	const [DiffComponents, setDiffComponents] =
		useState<DiffComponentsType | null>(null);

	useEffect(() => {
		Promise.all([
			import('@pierre/diffs/react'),
			import('@pierre/diffs'),
			import('../../lib/worker-pool'),
		]).then(([diffsReact, diffs, workerPool]) => {
			setDiffComponents({
				FileDiff: diffsReact.FileDiff,
				parsePatchFiles: diffs.parsePatchFiles,
				defaultDiffOptions: workerPool.defaultDiffOptions,
			});
		});
	}, []);

	useEffect(() => {
		if (selectedFile && fileRefs.current.has(selectedFile)) {
			const element = fileRefs.current.get(selectedFile);
			element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}, [selectedFile]);

	const setFileRef = useCallback(
		(filePath: string, element: HTMLDivElement | null) => {
			if (element) {
				fileRefs.current.set(filePath, element);
			} else {
				fileRefs.current.delete(filePath);
			}
		},
		[],
	);

	// Track if we just completed a multi-line selection to prevent hover utility from overwriting
	const justSelectedMultiLineRef = useRef(false);

	const handleAddComment = useCallback(
		(
			filePath: string,
			getHoveredLine: () => HoveredLineResult | undefined,
		) => {
			// Skip if we just completed a multi-line selection
			// (mouse-up after drag can trigger hover utility click)
			if (justSelectedMultiLineRef.current) {
				return;
			}

			const hoveredLine = getHoveredLine();
			if (hoveredLine) {
				dispatch({
					type: 'SET_COMMENT_FORM',
					payload: {
						filePath,
						lineStart: hoveredLine.lineNumber,
						side: hoveredLine.side,
					},
				});
			}
		},
		[],
	);

	const handleLineSelectionEnd = useCallback(
		(filePath: string, range: SelectedLineRange | null) => {
			if (range) {
				const isMultiLine = range.start !== range.end;
				justSelectedMultiLineRef.current = isMultiLine;

				// Reset the flag after a short delay to allow single-line clicks again
				if (isMultiLine) {
					setTimeout(() => {
						justSelectedMultiLineRef.current = false;
					}, 100);
				}

				dispatch({
					type: 'SET_SELECTED_LINES',
					payload: new Map(selectedLines).set(filePath, range),
				});
				dispatch({
					type: 'SET_COMMENT_FORM',
					payload: {
						filePath,
						lineStart: Math.min(range.start, range.end),
						lineEnd: Math.max(range.start, range.end),
						side: range.side || 'additions',
					},
				});
			}
		},
		[selectedLines],
	);

	const handleFileComment = useCallback((filePath: string) => {
		dispatch({
			type: 'SET_COMMENT_FORM',
			payload: {
				filePath,
				side: 'additions',
				isFileComment: true,
			},
		});
	}, []);

	const handleHunkComment = useCallback(
		(filePath: string, hunk: Hunk, _hunkIndex: number) => {
			const { start, end } = getActualChangedLineRange(hunk);
			dispatch({
				type: 'SET_COMMENT_FORM',
				payload: {
					filePath,
					lineStart: start,
					lineEnd: end,
					side: 'additions',
				},
			});
			setTimeout(() => {
				const commentFormEl = document.querySelector(
					'[data-comment-form]',
				);
				commentFormEl?.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
				});
			}, 100);
		},
		[],
	);

	const handleCloseComment = useCallback(() => {
		dispatch({ type: 'CLOSE_COMMENT' });
	}, []);

	// Memoize parsing - only re-parse when rawDiff changes
	const { parsedPatches, allFiles, filePathToIndex } = useMemo(() => {
		if (!DiffComponents) {
			return {
				parsedPatches: [],
				allFiles: [],
				filePathToIndex: new Map<string, number>(),
			};
		}
		const patches = DiffComponents.parsePatchFiles(rawDiff);
		const parsedFiles = patches.flatMap((p) => p.files || []);
		const pathMap = new Map<string, number>();
		parsedFiles.forEach((file, index) => {
			const path = file.name || file.prevName || `file-${index}`;
			pathMap.set(path, index);
		});
		return {
			parsedPatches: patches,
			allFiles: parsedFiles,
			filePathToIndex: pathMap,
		};
	}, [rawDiff, DiffComponents]);

	// Build a lookup map for file metadata (additions/deletions) by path
	const fileMetadataMap = useMemo(() => {
		const map = new Map<string, { additions: number; deletions: number }>();
		for (const file of files) {
			map.set(file.path, {
				additions: file.additions,
				deletions: file.deletions,
			});
		}
		return map;
	}, [files]);

	// Initialize expanded files on first load or when rawDiff changes
	// Auto-collapse large files and lock files even if they're in the first 10
	useEffect(() => {
		if (allFiles.length > 0 && !isInitialized) {
			const initialExpanded = new Set<string>();
			let expandedCount = 0;

			for (
				let i = 0;
				i < allFiles.length && expandedCount < DEFAULT_EXPANDED_COUNT;
				i++
			) {
				const filePath =
					allFiles[i].name || allFiles[i].prevName || `file-${i}`;

				// Get file metadata to check total changes
				const metadata = fileMetadataMap.get(filePath);
				const totalChanges = metadata
					? metadata.additions + metadata.deletions
					: 0;

				// Skip files that should be auto-collapsed
				if (
					shouldAutoCollapseFile(
						filePath,
						totalChanges,
						largeFileThreshold,
					)
				) {
					continue;
				}

				initialExpanded.add(filePath);
				expandedCount++;
			}
			dispatch({ type: 'SET_EXPANDED_FILES', payload: initialExpanded });
			dispatch({ type: 'SET_IS_INITIALIZED', payload: true });
		}
	}, [allFiles, isInitialized, fileMetadataMap, largeFileThreshold]);

	// Reset state when rawDiff changes (different PR)
	useEffect(() => {
		dispatch({ type: 'RESET_FOR_NEW_DIFF' });
	}, [rawDiff]);

	// Toggle file expanded state
	const toggleFileExpanded = useCallback((filePath: string) => {
		dispatch({ type: 'TOGGLE_FILE_EXPANDED', payload: filePath });
	}, []);

	// Collapse all files
	const collapseAll = useCallback(() => {
		dispatch({ type: 'COLLAPSE_ALL' });
	}, []);

	// Scroll to file and expand it
	const scrollToFile = useCallback(
		(filePath: string) => {
			// Expand the file if collapsed
			if (!expandedFiles.has(filePath)) {
				dispatch({
					type: 'TOGGLE_FILE_EXPANDED',
					payload: filePath,
				});
			}
			// Scroll to the file element
			const element = fileRefs.current.get(filePath);
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		},
		[expandedFiles],
	);

	// Expose scrollToFile to parent
	useEffect(() => {
		if (scrollToFileRef) {
			scrollToFileRef.current = scrollToFile;
		}
		return () => {
			if (scrollToFileRef) {
				scrollToFileRef.current = null;
			}
		};
	}, [scrollToFile, scrollToFileRef]);

	// Mark file as loaded when FileDiff finishes rendering
	const markFileLoaded = useCallback((filePath: string) => {
		dispatch({ type: 'MARK_FILE_LOADED', payload: filePath });
	}, []);

	if (!DiffComponents) {
		return (
			<div className="flex items-center justify-center h-full gap-2">
				<Spinner size="2" />
				<Text size="2" color="gray">
					Loading diff viewer...
				</Text>
			</div>
		);
	}

	const { FileDiff, defaultDiffOptions } = DiffComponents;

	return (
		<div className={className}>
			{/* Header with Collapse All button */}
			<div
				className="sticky top-0 z-20 flex items-center justify-between px-4 py-2"
				style={{
					backgroundColor: 'var(--color-bg)',
					borderBottom: '1px solid var(--color-border)',
				}}
			>
				<Text size="2" weight="medium">
					{allFiles.length} file{allFiles.length !== 1 ? 's' : ''}{' '}
					changed
				</Text>
				<Tooltip content="Collapse all files">
					<Button
						variant="ghost"
						size="1"
						onClick={collapseAll}
						className="btn-press"
					>
						<VscCollapseAll className="w-4 h-4" />
						Collapse All
					</Button>
				</Tooltip>
			</div>

			{/* File list */}
			<div
				ref={parentRef}
				className="overflow-auto"
				style={{ height: 'calc(100% - 40px)' }}
			>
				{allFiles.map((fileDiff, index) => {
					const filePath =
						fileDiff.name || fileDiff.prevName || `file-${index}`;
					const isExpanded = expandedFiles.has(filePath);
					const isLoaded = loadedFiles.has(filePath);
					const fileSelectedLines =
						selectedLines.get(filePath) || null;
					const isCommentingOnThisFile =
						commentForm?.filePath === filePath;
					const isFileComment =
						isCommentingOnThisFile && commentForm?.isFileComment;

					// Build line annotations:
					// 1. Comment indicators for lines with existing comments
					// 2. Comment form if actively commenting on this file
					const fileCommentsMap = commentMap.get(filePath);
					const indicatorAnnotations: Array<{
						side: AnnotationSide;
						lineNumber: number;
						metadata: CommentIndicatorAnnotation;
					}> = [];

					if (fileCommentsMap) {
						for (const [
							lineNum,
							lineComments,
						] of fileCommentsMap.entries()) {
							// Skip if we're currently editing this line (form will show instead)
							if (
								isCommentingOnThisFile &&
								commentForm.lineStart === lineNum
							) {
								continue;
							}
							indicatorAnnotations.push({
								side: 'additions', // Default to additions side
								lineNumber: lineNum,
								metadata: {
									type: 'comment-indicator',
									comments: lineComments,
								},
							});
						}
					}

					const formAnnotation =
						isCommentingOnThisFile &&
						!isFileComment &&
						commentForm.lineStart !== undefined
							? [
									{
										side: commentForm.side,
										lineNumber:
											commentForm.lineEnd ??
											commentForm.lineStart,
										metadata: {
											type: 'comment-form' as const,
											lineStart: commentForm.lineStart,
											lineEnd: commentForm.lineEnd,
										},
									},
								]
							: [];

					const lineAnnotations = [
						...indicatorAnnotations,
						...formAnnotation,
					];

					return (
						<div
							key={filePath}
							ref={(el) => setFileRef(filePath, el)}
							className="file-diff-container"
							style={{
								borderBottom: '1px solid var(--color-border)',
							}}
							data-file-path={filePath}
						>
							<StickyFileHeader
								fileDiff={fileDiff}
								isExpanded={isExpanded}
								onToggleExpanded={() =>
									toggleFileExpanded(filePath)
								}
								onAddComment={() => handleFileComment(filePath)}
								onAddHunkComment={(hunk, hunkIndex) =>
									handleHunkComment(filePath, hunk, hunkIndex)
								}
							/>

							{/* Only render FileDiff content when expanded */}
							{isExpanded && (
								<>
									{/* File-level comment form - appears at top */}
									{isFileComment && (
										<InlineCommentForm
											sessionId={sessionId}
											filePath={filePath}
											onClose={handleCloseComment}
											onSendNow={
												onSendNow
													? (content) => {
															onSendNow(
																content,
																filePath,
															);
															handleCloseComment();
														}
													: undefined
											}
										/>
									)}

									{/* Show skeleton while FileDiff is loading */}
									{!isLoaded && (
										<div className="p-4 space-y-3">
											<div className="h-4 w-3/4 rounded animate-pulse bg-theme-surface-hover" />
											<div className="h-4 w-full rounded animate-pulse bg-theme-surface-hover" />
											<div className="h-4 w-5/6 rounded animate-pulse bg-theme-surface-hover" />
											<div className="h-4 w-full rounded animate-pulse bg-theme-surface-hover" />
											<div className="h-4 w-2/3 rounded animate-pulse bg-theme-surface-hover" />
											<div className="h-4 w-full rounded animate-pulse bg-theme-surface-hover" />
											<div className="h-4 w-4/5 rounded animate-pulse bg-theme-surface-hover" />
											<div className="h-4 w-full rounded animate-pulse bg-theme-surface-hover" />
										</div>
									)}

									<div
										style={{
											display: isLoaded
												? 'block'
												: 'none',
										}}
									>
										<FileDiffWrapper
											FileDiff={FileDiff}
											fileDiff={fileDiff}
											filePath={filePath}
											fileSelectedLines={
												fileSelectedLines
											}
											lineAnnotations={lineAnnotations}
											defaultDiffOptions={
												defaultDiffOptions
											}
											diffStyle={diffStyle}
											resolvedTheme={resolvedTheme}
											handleLineSelectionEnd={
												handleLineSelectionEnd
											}
											handleAddComment={handleAddComment}
											sessionId={sessionId}
											commentForm={commentForm}
											onSendNow={onSendNow}
											onCommentChange={onCommentChange}
											handleCloseComment={
												handleCloseComment
											}
											onLoaded={() =>
												markFileLoaded(filePath)
											}
										/>
									</div>
								</>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function DiffViewer({
	rawDiff,
	className,
	diffStyle = 'split',
	selectedFile,
	sessionId,
	files,
	largeFileThreshold,
	existingComments,
	onSendNow,
	onCommentChange,
	scrollToFileRef,
}: DiffViewerProps) {
	if (!rawDiff) {
		return (
			<div className="flex items-center justify-center h-full">
				<Text size="2" color="gray">
					No changes to display
				</Text>
			</div>
		);
	}

	return (
		<DiffViewerClient
			rawDiff={rawDiff}
			className={className}
			diffStyle={diffStyle}
			selectedFile={selectedFile}
			sessionId={sessionId}
			files={files}
			largeFileThreshold={largeFileThreshold}
			existingComments={existingComments}
			onSendNow={onSendNow}
			onCommentChange={onCommentChange}
			scrollToFileRef={scrollToFileRef}
		/>
	);
}
