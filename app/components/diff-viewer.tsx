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
	Button,
	DropdownMenu,
	IconButton,
	Spinner,
	Text,
	Tooltip,
} from '@radix-ui/themes';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
		<div
			className="h-4 w-3/4 rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
		<div
			className="h-4 w-full rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
		<div
			className="h-4 w-5/6 rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
		<div
			className="h-4 w-full rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
		<div
			className="h-4 w-2/3 rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
		<div
			className="h-4 w-full rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
		<div
			className="h-4 w-4/5 rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
		<div
			className="h-4 w-full rounded animate-pulse"
			style={{ backgroundColor: 'var(--color-surface-hover)' }}
		/>
	</div>
);

// Default number of files to expand initially
const DEFAULT_EXPANDED_COUNT = 10;

// Estimated heights for virtualization
const COLLAPSED_HEIGHT = 52; // Header only
const EXPANDED_HEIGHT_ESTIMATE = 400; // Initial estimate for expanded files

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

interface DiffViewerProps {
	rawDiff: string;
	className?: string;
	diffStyle?: DiffStyle;
	selectedFile?: string | null;
	sessionId: string;
	onFileVisible?: (filePath: string) => void;
	onSendNow?: (
		content: string,
		filePath: string,
		lineStart?: number,
		lineEnd?: number,
	) => void;
	/** Ref callback to expose scrollToFile function to parent */
	scrollToFileRef?: React.MutableRefObject<
		((filePath: string) => void) | null
	>;
}

interface CommentAnnotation {
	type: 'comment-form';
	lineStart: number;
	lineEnd?: number;
}

function DiffViewerClient({
	rawDiff,
	className,
	diffStyle = 'split',
	selectedFile,
	sessionId,
	onSendNow,
	scrollToFileRef,
}: Omit<DiffViewerProps, 'onFileVisible'>) {
	const { resolvedTheme } = useTheme();
	const parentRef = useRef<HTMLDivElement>(null);
	const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const [commentForm, setCommentForm] = useState<CommentFormData | null>(
		null,
	);
	const [selectedLines, setSelectedLines] = useState<
		Map<string, SelectedLineRange | null>
	>(new Map());

	// Track which files are expanded (show FileDiff) vs collapsed (header only)
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
	const [isInitialized, setIsInitialized] = useState(false);

	// Track which FileDiff components have finished loading
	const [loadedFiles, setLoadedFiles] = useState<Set<string>>(new Set());

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
				setCommentForm({
					filePath,
					lineStart: hoveredLine.lineNumber,
					side: hoveredLine.side,
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

				setSelectedLines((prev) => new Map(prev).set(filePath, range));
				setCommentForm({
					filePath,
					lineStart: Math.min(range.start, range.end),
					lineEnd: Math.max(range.start, range.end),
					side: range.side || 'additions',
				});
			}
		},
		[],
	);

	const handleFileComment = useCallback((filePath: string) => {
		setCommentForm({
			filePath,
			side: 'additions',
			isFileComment: true,
		});
	}, []);

	const handleHunkComment = useCallback(
		(filePath: string, hunk: Hunk, _hunkIndex: number) => {
			const { start, end } = getActualChangedLineRange(hunk);
			setCommentForm({
				filePath,
				lineStart: start,
				lineEnd: end,
				side: 'additions',
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
		setCommentForm(null);
		setSelectedLines(new Map());
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
		const files = patches.flatMap((p) => p.files || []);
		const pathMap = new Map<string, number>();
		files.forEach((file, index) => {
			const path = file.name || file.prevName || `file-${index}`;
			pathMap.set(path, index);
		});
		return {
			parsedPatches: patches,
			allFiles: files,
			filePathToIndex: pathMap,
		};
	}, [rawDiff, DiffComponents]);

	// Initialize expanded files on first load or when rawDiff changes
	useEffect(() => {
		if (allFiles.length > 0 && !isInitialized) {
			const initialExpanded = new Set<string>();
			for (
				let i = 0;
				i < Math.min(DEFAULT_EXPANDED_COUNT, allFiles.length);
				i++
			) {
				const filePath =
					allFiles[i].name || allFiles[i].prevName || `file-${i}`;
				initialExpanded.add(filePath);
			}
			setExpandedFiles(initialExpanded);
			setIsInitialized(true);
		}
	}, [allFiles, isInitialized]);

	// Reset state when rawDiff changes (different PR)
	useEffect(() => {
		setIsInitialized(false);
		setExpandedFiles(new Set());
		setLoadedFiles(new Set());
	}, [rawDiff]);

	// Virtualizer for file list
	const virtualizer = useVirtualizer({
		count: allFiles.length,
		getScrollElement: () => parentRef.current,
		estimateSize: useCallback(
			(index: number) => {
				const filePath =
					allFiles[index]?.name ||
					allFiles[index]?.prevName ||
					`file-${index}`;
				return expandedFiles.has(filePath)
					? EXPANDED_HEIGHT_ESTIMATE
					: COLLAPSED_HEIGHT;
			},
			[allFiles, expandedFiles],
		),
		overscan: 3,
	});

	// Toggle file expanded state
	const toggleFileExpanded = useCallback((filePath: string) => {
		setExpandedFiles((prev) => {
			const next = new Set(prev);
			if (next.has(filePath)) {
				next.delete(filePath);
			} else {
				next.add(filePath);
			}
			return next;
		});
	}, []);

	// Collapse all files
	const collapseAll = useCallback(() => {
		setExpandedFiles(new Set());
	}, []);

	// Scroll to file and expand it
	const scrollToFile = useCallback(
		(filePath: string) => {
			const index = filePathToIndex.get(filePath);
			if (index !== undefined) {
				// Expand the file if collapsed
				setExpandedFiles((prev) => {
					if (prev.has(filePath)) return prev;
					const next = new Set(prev);
					next.add(filePath);
					return next;
				});
				// Scroll to the file
				virtualizer.scrollToIndex(index, { align: 'start' });
			}
		},
		[filePathToIndex, virtualizer],
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
		setLoadedFiles((prev) => {
			if (prev.has(filePath)) return prev;
			const next = new Set(prev);
			next.add(filePath);
			return next;
		});
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
					backgroundColor: 'var(--color-background)',
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

			{/* Virtualized file list */}
			<div
				ref={parentRef}
				className="overflow-auto"
				style={{ height: 'calc(100% - 40px)' }}
			>
				<div
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						width: '100%',
						position: 'relative',
					}}
				>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const fileDiff = allFiles[virtualRow.index];
						const filePath =
							fileDiff.name ||
							fileDiff.prevName ||
							`file-${virtualRow.index}`;
						const isExpanded = expandedFiles.has(filePath);
						const isLoaded = loadedFiles.has(filePath);
						const fileSelectedLines =
							selectedLines.get(filePath) || null;
						const isCommentingOnThisFile =
							commentForm?.filePath === filePath;
						const isFileComment =
							isCommentingOnThisFile &&
							commentForm?.isFileComment;

						// Only create line annotations for non-file comments
						const lineAnnotations =
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
												lineStart:
													commentForm.lineStart,
												lineEnd: commentForm.lineEnd,
											},
										},
									]
								: [];

						return (
							<div
								key={virtualRow.key}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
								className="file-diff-container"
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									transform: `translateY(${virtualRow.start}px)`,
									borderBottom:
										'1px solid var(--color-border)',
								}}
								data-file-path={filePath}
							>
								<StickyFileHeader
									fileDiff={fileDiff}
									isExpanded={isExpanded}
									onToggleExpanded={() =>
										toggleFileExpanded(filePath)
									}
									onAddComment={() =>
										handleFileComment(filePath)
									}
									onAddHunkComment={(hunk, hunkIndex) =>
										handleHunkComment(
											filePath,
											hunk,
											hunkIndex,
										)
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
												lineAnnotations={
													lineAnnotations
												}
												defaultDiffOptions={
													defaultDiffOptions
												}
												diffStyle={diffStyle}
												resolvedTheme={resolvedTheme}
												handleLineSelectionEnd={
													handleLineSelectionEnd
												}
												handleAddComment={
													handleAddComment
												}
												sessionId={sessionId}
												commentForm={commentForm}
												onSendNow={onSendNow}
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
	handleCloseComment: () => void;
	onLoaded: () => void;
}

interface HoveredLineResult {
	lineNumber: number;
	lineElement: HTMLElement;
	side: AnnotationSide;
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
				<Tooltip content="Add comment">
					<IconButton
						size="1"
						variant="solid"
						aria-label="Add comment"
						onClick={() =>
							handleAddComment(filePath, getHoveredLine)
						}
					>
						<VscAdd className="w-3 h-3" />
					</IconButton>
				</Tooltip>
			)}
			renderAnnotation={(annotation: {
				side: AnnotationSide;
				lineNumber: number;
				metadata: CommentAnnotation;
			}) => (
				<InlineCommentForm
					sessionId={sessionId}
					filePath={filePath}
					lineStart={annotation.metadata.lineStart}
					lineEnd={annotation.metadata.lineEnd}
					side={annotation.side === 'additions' ? 'new' : 'old'}
					onClose={handleCloseComment}
					onSendNow={
						onSendNow
							? (content) => {
									onSendNow(
										content,
										filePath,
										annotation.metadata.lineStart,
										annotation.metadata.lineEnd,
									);
									handleCloseComment();
								}
							: undefined
					}
				/>
			)}
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
				return (
					<VscDiffAdded
						className="w-5 h-5"
						style={{ color: 'var(--color-success-green)' }}
					/>
				);
			case 'deleted':
				return (
					<VscDiffRemoved
						className="w-5 h-5"
						style={{ color: 'var(--color-danger-red)' }}
					/>
				);
			case 'rename-pure':
			case 'rename-changed':
				return (
					<VscFile
						className="w-5 h-5"
						style={{ color: 'var(--color-warning-amber)' }}
					/>
				);
			default:
				return (
					<VscDiffModified
						className="w-5 h-5"
						style={{ color: 'var(--color-accent)' }}
					/>
				);
		}
	};

	const getLabel = (type: ChangeTypes) => {
		switch (type) {
			case 'new':
				return (
					<span className="status-pill status-pill-added">Added</span>
				);
			case 'deleted':
				return (
					<span className="status-pill status-pill-deleted">
						Deleted
					</span>
				);
			case 'rename-pure':
				return (
					<span className="status-pill status-pill-renamed">
						Renamed
					</span>
				);
			case 'rename-changed':
				return (
					<span className="status-pill status-pill-renamed">
						Renamed & Modified
					</span>
				);
			default:
				return (
					<span className="status-pill status-pill-modified">
						Modified
					</span>
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
				<button
					type="button"
					className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
					aria-label={isExpanded ? 'Collapse file' : 'Expand file'}
					aria-expanded={isExpanded}
				>
					{isExpanded ? (
						<VscChevronDown
							className="w-4 h-4"
							style={{ color: 'var(--color-text-muted)' }}
						/>
					) : (
						<VscChevronRight
							className="w-4 h-4"
							style={{ color: 'var(--color-text-muted)' }}
						/>
					)}
				</button>
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
						<Text
							size="1"
							className="shrink-0"
							style={{ color: 'var(--color-text-muted)' }}
						>
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
	onSendNow,
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
			onSendNow={onSendNow}
			scrollToFileRef={scrollToFileRef}
		/>
	);
}
