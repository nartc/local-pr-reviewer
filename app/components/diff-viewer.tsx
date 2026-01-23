import type {
	AnnotationSide,
	ChangeContent,
	ChangeTypes,
	ContextContent,
	FileDiffMetadata,
	Hunk,
	ParsedPatch,
} from '@pierre/diffs';
import {
	Badge,
	Button,
	DropdownMenu,
	IconButton,
	Popover,
	Spinner,
	Text,
	Tooltip,
} from '@radix-ui/themes';

import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react';
import {
	VscAdd,
	VscChevronDown,
	VscChevronRight,
	VscCollapseAll,
	VscComment,
	VscDiffAdded,
	VscDiffModified,
	VscDiffRemoved,
	VscFile,
} from 'react-icons/vsc';
import { useTheme } from '../lib/theme';
import type { Comment } from '../services/comment.service';
import type { DiffFile } from './file-explorer';
import { InlineCommentForm } from './inline-comment-form';

// Hoisted static loading states
const DiffLoadingState = (
	<div className="flex items-center justify-center h-full gap-2">
		<Spinner size="2" />
		<Text size="2" color="gray">
			Loading diff viewer...
		</Text>
	</div>
);

const NoDiffState = (
	<div className="flex items-center justify-center h-full">
		<Text size="2" color="gray">
			No changes to display
		</Text>
	</div>
);

const HydrationLoadingState = (
	<div className="flex items-center justify-center h-full gap-2">
		<Spinner size="2" />
		<Text size="2" color="gray">
			Loading diff...
		</Text>
	</div>
);

// Skeleton for FileDiff while it's mounting
const FileDiffSkeleton = (
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
);

// Default number of files to expand initially
const DEFAULT_EXPANDED_COUNT = 10;

// Default threshold for auto-collapsing large files (total lines changed)
const DEFAULT_LARGE_FILE_THRESHOLD = 500;

// Patterns for files that should be auto-collapsed (lock files, generated files, etc.)
const AUTO_COLLAPSE_PATTERNS = [
	// JavaScript/Node
	/package-lock\.json$/,
	/yarn\.lock$/,
	/pnpm-lock\.yaml$/,
	/npm-shrinkwrap\.json$/,
	// Ruby
	/Gemfile\.lock$/,
	// Rust
	/Cargo\.lock$/,
	// PHP
	/composer\.lock$/,
	// Python
	/Pipfile\.lock$/,
	/poetry\.lock$/,
	/pdm\.lock$/,
	/uv\.lock$/,
	// .NET
	/packages\.lock\.json$/,
	// Go
	/go\.sum$/,
	// Elixir
	/mix\.lock$/,
	// Swift/iOS
	/Podfile\.lock$/,
	/Package\.resolved$/,
	// Generic lock files
	/\.lock$/,
	/\.lockb$/,
];

/**
 * Check if a file should be auto-collapsed based on patterns or size
 */
function shouldAutoCollapseFile(
	filePath: string,
	totalChanges: number,
	threshold: number,
): boolean {
	// Check if file matches auto-collapse patterns
	if (AUTO_COLLAPSE_PATTERNS.some((pattern) => pattern.test(filePath))) {
		return true;
	}
	// Check if file has too many changes
	if (totalChanges > threshold) {
		return true;
	}
	return false;
}

/**
 * Calculate the actual changed line range within a hunk.
 * The hunk's additionStart/additionLines includes context lines,
 * but we want the actual first and last changed (added) lines.
 */
function getActualChangedLineRange(hunk: Hunk): {
	start: number;
	end: number;
} {
	let lineNumber = hunk.additionStart;
	let firstChangeLine: number | null = null;
	let lastChangeLine: number | null = null;

	for (const content of hunk.hunkContent) {
		if (content.type === 'context') {
			lineNumber += (content as ContextContent).lines.length;
		} else if (content.type === 'change') {
			const changeContent = content as ChangeContent;
			if (changeContent.additions.length > 0) {
				if (firstChangeLine === null) {
					firstChangeLine = lineNumber;
				}
				lineNumber += changeContent.additions.length;
				lastChangeLine = lineNumber - 1;
			}
		}
	}

	// Fallback to hunk range if no changes found
	return {
		start: firstChangeLine ?? hunk.additionStart,
		end: lastChangeLine ?? hunk.additionStart + hunk.additionLines - 1,
	};
}

type DiffStyle = 'split' | 'unified';

interface SelectedLineRange {
	start: number;
	end: number;
	side?: AnnotationSide;
	endSide?: AnnotationSide;
}

interface CommentFormData {
	filePath: string;
	lineStart?: number;
	lineEnd?: number;
	side: AnnotationSide;
	isFileComment?: boolean;
}

// Reducer state and actions for DiffViewerClient
interface DiffViewerState {
	commentForm: CommentFormData | null;
	selectedLines: Map<string, SelectedLineRange | null>;
	expandedFiles: Set<string>;
	isInitialized: boolean;
	loadedFiles: Set<string>;
}

type DiffViewerAction =
	| { type: 'SET_COMMENT_FORM'; payload: CommentFormData | null }
	| {
			type: 'SET_SELECTED_LINES';
			payload: Map<string, SelectedLineRange | null>;
	  }
	| { type: 'SET_EXPANDED_FILES'; payload: Set<string> }
	| { type: 'TOGGLE_FILE_EXPANDED'; payload: string }
	| { type: 'COLLAPSE_ALL' }
	| { type: 'SET_IS_INITIALIZED'; payload: boolean }
	| { type: 'SET_LOADED_FILES'; payload: Set<string> }
	| { type: 'MARK_FILE_LOADED'; payload: string }
	| { type: 'CLOSE_COMMENT' }
	| { type: 'RESET_FOR_NEW_DIFF' };

function diffViewerReducer(
	state: DiffViewerState,
	action: DiffViewerAction,
): DiffViewerState {
	switch (action.type) {
		case 'SET_COMMENT_FORM':
			return { ...state, commentForm: action.payload };
		case 'SET_SELECTED_LINES':
			return { ...state, selectedLines: action.payload };
		case 'SET_EXPANDED_FILES':
			return { ...state, expandedFiles: action.payload };
		case 'TOGGLE_FILE_EXPANDED': {
			const next = new Set(state.expandedFiles);
			if (next.has(action.payload)) {
				next.delete(action.payload);
			} else {
				next.add(action.payload);
			}
			return { ...state, expandedFiles: next };
		}
		case 'COLLAPSE_ALL':
			return { ...state, expandedFiles: new Set() };
		case 'SET_IS_INITIALIZED':
			return { ...state, isInitialized: action.payload };
		case 'SET_LOADED_FILES':
			return { ...state, loadedFiles: action.payload };
		case 'MARK_FILE_LOADED': {
			if (state.loadedFiles.has(action.payload)) return state;
			const next = new Set(state.loadedFiles);
			next.add(action.payload);
			return { ...state, loadedFiles: next };
		}
		case 'CLOSE_COMMENT':
			return { ...state, commentForm: null, selectedLines: new Map() };
		case 'RESET_FOR_NEW_DIFF':
			return {
				...state,
				isInitialized: false,
				expandedFiles: new Set(),
				loadedFiles: new Set(),
			};
		default:
			return state;
	}
}

const initialDiffViewerState: DiffViewerState = {
	commentForm: null,
	selectedLines: new Map(),
	expandedFiles: new Set(),
	isInitialized: false,
	loadedFiles: new Set(),
};

interface DiffViewerProps {
	rawDiff: string;
	className?: string;
	diffStyle?: DiffStyle;
	selectedFile?: string | null;
	sessionId: string;
	/** File metadata with additions/deletions for auto-collapse logic */
	files?: DiffFile[];
	/** Threshold for auto-collapsing files with many changes (default: 500) */
	largeFileThreshold?: number;
	/** Existing comments to show indicators for */
	existingComments?: Comment[];
	onFileVisible?: (filePath: string) => void;
	onSendNow?: (
		content: string,
		filePath: string,
		lineStart?: number,
		lineEnd?: number,
	) => void;
	/** Called when a comment is created/updated/deleted */
	onCommentChange?: () => void;
	/** Ref callback to expose scrollToFile function to parent */
	scrollToFileRef?: React.MutableRefObject<
		((filePath: string) => void) | null
	>;
}

interface CommentFormAnnotation {
	type: 'comment-form';
	lineStart: number;
	lineEnd?: number;
}

interface CommentIndicatorAnnotation {
	type: 'comment-indicator';
	comments: Comment[];
}

type CommentAnnotation = CommentFormAnnotation | CommentIndicatorAnnotation;

/** Map of file path -> line number -> comments at that line */
type CommentMap = Map<string, Map<number, Comment[]>>;

/**
 * Build a map of comments by file path and line number for quick lookup
 */
function buildCommentMap(comments: Comment[]): CommentMap {
	const map: CommentMap = new Map();

	for (const comment of comments) {
		if (!map.has(comment.file_path)) {
			map.set(comment.file_path, new Map());
		}
		const fileMap = map.get(comment.file_path)!;

		// For single line comments or file-level comments
		if (comment.line_start !== null) {
			const lineKey = comment.line_start;
			if (!fileMap.has(lineKey)) {
				fileMap.set(lineKey, []);
			}
			fileMap.get(lineKey)!.push(comment);

			// For multi-line comments, also index by end line
			if (
				comment.line_end !== null &&
				comment.line_end !== comment.line_start
			) {
				if (!fileMap.has(comment.line_end)) {
					fileMap.set(comment.line_end, []);
				}
				// Only add if not already there (avoid duplicates)
				const endLineComments = fileMap.get(comment.line_end)!;
				if (!endLineComments.includes(comment)) {
					endLineComments.push(comment);
				}
			}
		}
	}

	return map;
}

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

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [DiffComponents, setDiffComponents] = useState<{
		FileDiff: React.ComponentType<any>;
		parsePatchFiles: (patch: string) => ParsedPatch[];
		defaultDiffOptions: Record<string, unknown>;
	} | null>(null);

	interface HoveredLineResult {
		lineNumber: number;
		lineElement: HTMLElement;
		side: AnnotationSide;
	}

	useEffect(() => {
		Promise.all([
			import('@pierre/diffs/react'),
			import('@pierre/diffs'),
			import('../lib/worker-pool'),
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

	// Track if we just completed a multi-line selection to prevent hover utility from overwriting
	const justSelectedMultiLineRef = useRef(false);

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
		[],
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
		return DiffLoadingState;
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
									{!isLoaded && FileDiffSkeleton}

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

// Wrapper component to detect when FileDiff has loaded
interface FileDiffWrapperProps {
	FileDiff: React.ComponentType<any>;
	fileDiff: FileDiffMetadata;
	filePath: string;
	fileSelectedLines: SelectedLineRange | null;
	lineAnnotations: Array<{
		side: AnnotationSide;
		lineNumber: number | undefined;
		metadata: CommentAnnotation;
	}>;
	defaultDiffOptions: Record<string, unknown>;
	diffStyle: DiffStyle;
	resolvedTheme: string;
	handleLineSelectionEnd: (
		filePath: string,
		range: SelectedLineRange | null,
	) => void;
	handleAddComment: (
		filePath: string,
		getHoveredLine: () => HoveredLineResult | undefined,
	) => void;
	sessionId: string;
	commentForm: CommentFormData | null;
	onSendNow?: (
		content: string,
		filePath: string,
		lineStart?: number,
		lineEnd?: number,
	) => void;
	onCommentChange?: () => void;
	handleCloseComment: () => void;
	onLoaded: () => void;
}

interface HoveredLineResult {
	lineNumber: number;
	lineElement: HTMLElement;
	side: AnnotationSide;
}

/**
 * Simple add comment button shown on hover.
 * Lines with existing comments show persistent indicators via annotations.
 */
function HoverAddCommentButton({
	getHoveredLine,
	filePath,
	handleAddComment,
}: {
	getHoveredLine: () => HoveredLineResult | undefined;
	filePath: string;
	handleAddComment: (
		filePath: string,
		getHoveredLine: () => HoveredLineResult | undefined,
	) => void;
}) {
	return (
		<Tooltip content="Add comment">
			<IconButton
				size="1"
				variant="solid"
				aria-label="Add comment"
				onClick={() => handleAddComment(filePath, getHoveredLine)}
			>
				<VscAdd className="w-3 h-3" />
			</IconButton>
		</Tooltip>
	);
}

/**
 * Badge shown in the gutter for lines with existing comments.
 * Renders as a small icon that opens a popover on click.
 */
function GutterCommentBadge({
	comments,
	lineNumber,
	filePath,
	sessionId,
	onCommentChange,
	onAddComment,
}: {
	comments: Comment[];
	lineNumber: number;
	filePath: string;
	sessionId: string;
	onCommentChange?: () => void;
	onAddComment: () => void;
}) {
	const hasEditableComments = comments.some(
		(c) => c.status === 'queued' || c.status === 'staged',
	);

	return (
		<div className="flex items-center gap-1 py-1">
			<Popover.Root>
				<Popover.Trigger>
					<IconButton
						size="1"
						variant="soft"
						color={hasEditableComments ? 'amber' : 'blue'}
						aria-label={`${comments.length} comment${comments.length > 1 ? 's' : ''} on line ${lineNumber}`}
					>
						<VscComment className="w-3 h-3" />
						{comments.length > 1 && (
							<span className="text-[10px] ml-0.5">
								{comments.length}
							</span>
						)}
					</IconButton>
				</Popover.Trigger>
				<Popover.Content
					side="right"
					align="start"
					className="w-80 max-h-96 overflow-auto"
				>
					<div className="space-y-3">
						<Text size="2" weight="medium">
							Comments on line {lineNumber}
						</Text>

						{/* List existing comments */}
						<div className="space-y-2">
							{comments.map((comment) => (
								<CommentPreviewCard
									key={comment.id}
									comment={comment}
									sessionId={sessionId}
									onCommentChange={onCommentChange}
								/>
							))}
						</div>

						{/* Add new comment button */}
						<Popover.Close>
							<Button
								size="1"
								variant="soft"
								className="w-full"
								onClick={onAddComment}
							>
								<VscAdd className="w-3 h-3" />
								Add another comment
							</Button>
						</Popover.Close>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	);
}

/**
 * Small preview card for a comment in the gutter popover
 */
function CommentPreviewCard({
	comment,
	sessionId,
	onCommentChange,
}: {
	comment: Comment;
	sessionId: string;
	onCommentChange?: () => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [isSaving, setIsSaving] = useState(false);

	const isEditable =
		comment.status === 'queued' || comment.status === 'staged';
	const statusColors: Record<string, 'amber' | 'blue' | 'green' | 'gray'> = {
		queued: 'amber',
		staged: 'blue',
		sent: 'green',
		resolved: 'gray',
	};

	const handleSave = async () => {
		if (!editContent.trim()) return;
		setIsSaving(true);

		try {
			const formData = new URLSearchParams();
			formData.append('intent', 'update');
			formData.append('commentId', comment.id);
			formData.append('content', editContent);

			await fetch('/api/comments', {
				method: 'POST',
				body: formData,
			});

			setIsEditing(false);
			onCommentChange?.();
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		try {
			const formData = new URLSearchParams();
			formData.append('intent', 'delete');
			formData.append('commentId', comment.id);

			await fetch('/api/comments', {
				method: 'POST',
				body: formData,
			});

			onCommentChange?.();
		} catch (error) {
			console.error('Failed to delete comment:', error);
		}
	};

	if (isEditing) {
		return (
			<div className="p-2 rounded-md border border-theme-border bg-theme-surface space-y-2">
				<textarea
					value={editContent}
					onChange={(e) => setEditContent(e.target.value)}
					className="w-full p-2 text-sm rounded border border-theme-border bg-theme-bg resize-none"
					rows={3}
					autoFocus
				/>
				<div className="flex gap-2 justify-end">
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => {
							setIsEditing(false);
							setEditContent(comment.content);
						}}
						disabled={isSaving}
					>
						Cancel
					</Button>
					<Button
						size="1"
						variant="solid"
						onClick={handleSave}
						disabled={isSaving || !editContent.trim()}
					>
						{isSaving ? 'Saving...' : 'Save'}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="p-2 rounded-md border border-theme-border bg-theme-surface">
			<div className="flex items-start justify-between gap-2">
				<Text size="1" className="line-clamp-3 flex-1">
					{comment.content}
				</Text>
				<Badge
					size="1"
					color={statusColors[comment.status] || 'gray'}
					variant="soft"
				>
					{comment.status}
				</Badge>
			</div>
			{isEditable && (
				<div className="flex gap-2 mt-2">
					<Button
						size="1"
						variant="ghost"
						onClick={() => setIsEditing(true)}
					>
						Edit
					</Button>
					<Button
						size="1"
						variant="ghost"
						color="red"
						onClick={handleDelete}
					>
						Delete
					</Button>
				</div>
			)}
		</div>
	);
}

function FileDiffWrapper({
	FileDiff,
	fileDiff,
	filePath,
	fileSelectedLines,
	lineAnnotations,
	defaultDiffOptions,
	diffStyle,
	resolvedTheme,
	handleLineSelectionEnd,
	handleAddComment,
	sessionId,
	onSendNow,
	onCommentChange,
	handleCloseComment,
	onLoaded,
}: FileDiffWrapperProps) {
	useEffect(() => {
		// Mark as loaded after a short delay to let the component render
		const timer = setTimeout(onLoaded, 50);
		return () => clearTimeout(timer);
	}, [onLoaded]);

	return (
		<FileDiff
			fileDiff={fileDiff}
			selectedLines={fileSelectedLines}
			lineAnnotations={lineAnnotations}
			options={{
				...defaultDiffOptions,
				diffStyle,
				themeType: resolvedTheme,
				disableFileHeader: true,
				enableHoverUtility: true,
				enableLineSelection: true,
				onLineSelectionEnd: (range: SelectedLineRange | null) =>
					handleLineSelectionEnd(filePath, range),
			}}
			renderHoverUtility={(
				getHoveredLine: () => HoveredLineResult | undefined,
			) => (
				<HoverAddCommentButton
					getHoveredLine={getHoveredLine}
					filePath={filePath}
					handleAddComment={handleAddComment}
				/>
			)}
			renderAnnotation={(annotation: {
				side: AnnotationSide;
				lineNumber: number;
				metadata: CommentAnnotation;
			}) => {
				const { metadata } = annotation;

				if (metadata.type === 'comment-form') {
					const formMeta = metadata as CommentFormAnnotation;
					return (
						<InlineCommentForm
							sessionId={sessionId}
							filePath={filePath}
							lineStart={formMeta.lineStart}
							lineEnd={formMeta.lineEnd}
							side={
								annotation.side === 'additions' ? 'new' : 'old'
							}
							onClose={handleCloseComment}
							onSendNow={
								onSendNow
									? (content) => {
											onSendNow(
												content,
												filePath,
												formMeta.lineStart,
												formMeta.lineEnd,
											);
											handleCloseComment();
										}
									: undefined
							}
						/>
					);
				}

				if (metadata.type === 'comment-indicator') {
					const indicatorMeta =
						metadata as CommentIndicatorAnnotation;
					return (
						<GutterCommentBadge
							comments={indicatorMeta.comments}
							lineNumber={annotation.lineNumber}
							filePath={filePath}
							sessionId={sessionId}
							onCommentChange={onCommentChange}
							onAddComment={() =>
								handleAddComment(filePath, () => ({
									lineNumber: annotation.lineNumber,
									lineElement: document.body,
									side: annotation.side,
								}))
							}
						/>
					);
				}

				return null;
			}}
		/>
	);
}

interface StickyFileHeaderProps {
	fileDiff: FileDiffMetadata;
	isExpanded: boolean;
	onToggleExpanded: () => void;
	onAddComment: () => void;
	onAddHunkComment: (hunk: Hunk, hunkIndex: number) => void;
}

const StickyFileHeader = memo(function StickyFileHeader({
	fileDiff,
	isExpanded,
	onToggleExpanded,
	onAddComment,
	onAddHunkComment,
}: StickyFileHeaderProps) {
	const fileName = fileDiff.name || fileDiff.prevName || 'unknown';
	const changeType = fileDiff.type;
	const hunks = fileDiff.hunks || [];

	const getIcon = (type: ChangeTypes) => {
		switch (type) {
			case 'new':
				return <VscDiffAdded className="w-5 h-5 text-theme-success" />;
			case 'deleted':
				return <VscDiffRemoved className="w-5 h-5 text-theme-danger" />;
			case 'rename-pure':
			case 'rename-changed':
				return <VscFile className="w-5 h-5 text-theme-warning" />;
			default:
				return (
					<VscDiffModified className="w-5 h-5 text-theme-accent" />
				);
		}
	};

	const getLabel = (type: ChangeTypes) => {
		switch (type) {
			case 'new':
				return (
					<Badge color="green" variant="soft" size="1">
						Added
					</Badge>
				);
			case 'deleted':
				return (
					<Badge color="red" variant="soft" size="1">
						Deleted
					</Badge>
				);
			case 'rename-pure':
				return (
					<Badge color="blue" variant="soft" size="1">
						Renamed
					</Badge>
				);
			case 'rename-changed':
				return (
					<Badge color="blue" variant="soft" size="1">
						Renamed & Modified
					</Badge>
				);
			default:
				return (
					<Badge color="amber" variant="soft" size="1">
						Modified
					</Badge>
				);
		}
	};

	const getHunkLabel = (hunk: Hunk, index: number) => {
		const { start, end } = getActualChangedLineRange(hunk);
		const context = hunk.hunkContext ? ` - ${hunk.hunkContext}` : '';
		return `Hunk ${index + 1}: Lines ${start}-${end}${context}`;
	};

	return (
		<div
			className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 cursor-pointer hover:brightness-95"
			style={{
				backgroundColor: 'var(--color-surface)',
				borderBottom: '1px solid var(--color-border)',
			}}
			onClick={onToggleExpanded}
		>
			<div className="flex items-center gap-3 min-w-0">
				{/* Expand/Collapse toggle */}
				<IconButton
					variant="ghost"
					size="1"
					className="shrink-0"
					aria-label={isExpanded ? 'Collapse file' : 'Expand file'}
					aria-expanded={isExpanded}
				>
					{isExpanded ? (
						<VscChevronDown className="w-4 h-4 text-theme-muted" />
					) : (
						<VscChevronRight className="w-4 h-4 text-theme-muted" />
					)}
				</IconButton>
				{getIcon(changeType)}
				<div className="flex items-center gap-2 min-w-0">
					<Text
						size="2"
						weight="medium"
						className="font-mono truncate"
					>
						{fileName}
					</Text>
					{fileDiff.prevName && fileDiff.prevName !== fileName && (
						<Text size="1" className="shrink-0 text-theme-muted">
							← {fileDiff.prevName}
						</Text>
					)}
				</div>
				{getLabel(changeType)}
			</div>
			<div
				className="flex items-center gap-2"
				onClick={(e) => e.stopPropagation()}
			>
				{isExpanded && hunks.length > 0 && (
					<DropdownMenu.Root>
						<Tooltip content="Comment on a hunk">
							<DropdownMenu.Trigger>
								<Button
									variant="ghost"
									size="1"
									className="btn-press"
								>
									<VscComment aria-hidden="true" />
									Hunk ({hunks.length})
								</Button>
							</DropdownMenu.Trigger>
						</Tooltip>
						<DropdownMenu.Content align="end">
							{hunks.map((hunk, index) => (
								<DropdownMenu.Item
									key={index}
									onSelect={() =>
										onAddHunkComment(hunk, index)
									}
								>
									{getHunkLabel(hunk, index)}
								</DropdownMenu.Item>
							))}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				)}
				{isExpanded && (
					<Tooltip content="Comment on entire file">
						<Button
							variant="ghost"
							size="1"
							onClick={onAddComment}
							className="btn-press"
						>
							<VscComment aria-hidden="true" />
							File
						</Button>
					</Tooltip>
				)}
			</div>
		</div>
	);
});

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
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	if (!rawDiff) {
		return NoDiffState;
	}

	if (!isClient) {
		return HydrationLoadingState;
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
