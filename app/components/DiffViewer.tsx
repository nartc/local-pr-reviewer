import type {
	AnnotationSide,
	ChangeTypes,
	FileDiffMetadata,
	Hunk,
	ParsedPatch,
} from '@pierre/diffs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	VscAdd,
	VscComment,
	VscDiffAdded,
	VscDiffModified,
	VscDiffRemoved,
	VscFile,
} from 'react-icons/vsc';
import { useTheme } from '../lib/theme.js';
import { InlineCommentForm } from './InlineCommentForm.js';

type DiffStyle = 'split' | 'unified';

interface SelectedLineRange {
	start: number;
	end: number;
	side?: AnnotationSide;
	endSide?: AnnotationSide;
}

interface CommentFormData {
	filePath: string;
	lineStart: number;
	lineEnd?: number;
	side: AnnotationSide;
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
		lineStart: number,
		lineEnd?: number,
	) => void;
}

// Annotation metadata for comment form
interface CommentAnnotation {
	type: 'comment-form';
	lineStart: number;
	lineEnd?: number;
}

// Dynamically loaded diff component to avoid SSR issues with @pierre/diffs
function DiffViewerClient({
	rawDiff,
	className,
	diffStyle = 'split',
	selectedFile,
	sessionId,
	onSendNow,
}: Omit<DiffViewerProps, 'onFileVisible'>) {
	const { resolvedTheme } = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const [commentForm, setCommentForm] = useState<CommentFormData | null>(
		null,
	);
	const [selectedLines, setSelectedLines] = useState<
		Map<string, SelectedLineRange | null>
	>(new Map());
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [DiffComponents, setDiffComponents] = useState<{
		FileDiff: React.ComponentType<any>;
		WorkerPoolContextProvider: React.ComponentType<any>;
		parsePatchFiles: (patch: string) => ParsedPatch[];
		poolOptions: any;
		highlighterOptions: any;
		defaultDiffOptions: Record<string, unknown>;
	} | null>(null);

	interface HoveredLineResult {
		lineNumber: number;
		lineElement: HTMLElement;
		side: AnnotationSide;
	}

	useEffect(() => {
		// Dynamic import to avoid SSR
		Promise.all([
			import('@pierre/diffs/react'),
			import('@pierre/diffs'),
			import('../lib/worker-pool.js'),
		]).then(([diffsReact, diffs, workerPool]) => {
			setDiffComponents({
				FileDiff: diffsReact.FileDiff,
				WorkerPoolContextProvider: diffsReact.WorkerPoolContextProvider,
				parsePatchFiles: diffs.parsePatchFiles,
				poolOptions: workerPool.poolOptions,
				highlighterOptions: workerPool.highlighterOptions,
				defaultDiffOptions: workerPool.defaultDiffOptions,
			});
		});
	}, []);

	// Scroll to selected file
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

	// Handle single line comment from hover button
	const handleAddComment = useCallback(
		(
			filePath: string,
			getHoveredLine: () => HoveredLineResult | undefined,
		) => {
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

	// Handle line selection end (click+drag)
	const handleLineSelectionEnd = useCallback(
		(filePath: string, range: SelectedLineRange | null) => {
			if (range) {
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

	// Handle file-level comment
	const handleFileComment = useCallback((filePath: string) => {
		setCommentForm({
			filePath,
			lineStart: 1,
			side: 'additions',
		});
	}, []);

	// Handle hunk-level comment
	const handleHunkComment = useCallback(
		(filePath: string, hunk: Hunk, _hunkIndex: number) => {
			setCommentForm({
				filePath,
				lineStart: hunk.additionStart,
				lineEnd: hunk.additionStart + hunk.additionLines - 1,
				side: 'additions',
			});
			// Scroll to the comment form after it renders
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

	if (!DiffComponents) {
		return (
			<div className="flex items-center justify-center h-full text-gray-500">
				<div className="flex items-center gap-2">
					<div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
					Loading diff viewer...
				</div>
			</div>
		);
	}

	const {
		FileDiff,
		WorkerPoolContextProvider,
		parsePatchFiles,
		poolOptions,
		highlighterOptions,
		defaultDiffOptions,
	} = DiffComponents;

	// Parse the multi-file patch
	const parsedPatches = parsePatchFiles(rawDiff);
	const allFiles = parsedPatches.flatMap((p) => p.files || []);

	return (
		<WorkerPoolContextProvider
			poolOptions={poolOptions}
			highlighterOptions={highlighterOptions}
		>
			<div ref={containerRef} className={className}>
				{allFiles.map((fileDiff, index) => {
					const filePath =
						fileDiff.name || fileDiff.prevName || `file-${index}`;
					const fileSelectedLines =
						selectedLines.get(filePath) || null;
					const isCommentingOnThisFile =
						commentForm?.filePath === filePath;

					// Create annotation for comment form
					const lineAnnotations = isCommentingOnThisFile
						? [
								{
									side: commentForm.side,
									lineNumber:
										commentForm.lineEnd ||
										commentForm.lineStart,
									metadata: {
										type: 'comment-form' as const,
										lineStart: commentForm.lineStart,
										lineEnd: commentForm.lineEnd,
									},
								},
							]
						: [];

					return (
						<div
							key={filePath}
							ref={(el) => setFileRef(filePath, el)}
							className="file-diff-container border-b border-gray-200 dark:border-gray-800 relative"
							data-file-path={filePath}
						>
							<StickyFileHeader
								fileDiff={fileDiff}
								onAddComment={() => handleFileComment(filePath)}
								onAddHunkComment={(hunk, hunkIndex) =>
									handleHunkComment(filePath, hunk, hunkIndex)
								}
							/>
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
									onLineSelectionEnd: (
										range: SelectedLineRange | null,
									) =>
										handleLineSelectionEnd(filePath, range),
								}}
								renderHoverUtility={(
									getHoveredLine: () =>
										| HoveredLineResult
										| undefined,
								) => (
									<button
										onClick={() =>
											handleAddComment(
												filePath,
												getHoveredLine,
											)
										}
										className="flex items-center justify-center w-5 h-5 rounded bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
										title="Add comment"
									>
										<VscAdd className="w-3 h-3" />
									</button>
								)}
								renderAnnotation={(annotation: {
									side: AnnotationSide;
									lineNumber: number;
									metadata: CommentAnnotation;
								}) => (
									<InlineCommentForm
										sessionId={sessionId}
										filePath={filePath}
										lineStart={
											annotation.metadata.lineStart
										}
										lineEnd={annotation.metadata.lineEnd}
										side={
											annotation.side === 'additions'
												? 'new'
												: 'old'
										}
										onClose={handleCloseComment}
										onSendNow={
											onSendNow
												? (content) => {
														onSendNow(
															content,
															filePath,
															annotation.metadata
																.lineStart,
															annotation.metadata
																.lineEnd,
														);
														handleCloseComment();
													}
												: undefined
										}
									/>
								)}
							/>
						</div>
					);
				})}
			</div>
		</WorkerPoolContextProvider>
	);
}

interface StickyFileHeaderProps {
	fileDiff: FileDiffMetadata;
	onAddComment: () => void;
	onAddHunkComment: (hunk: Hunk, hunkIndex: number) => void;
}

function StickyFileHeader({
	fileDiff,
	onAddComment,
	onAddHunkComment,
}: StickyFileHeaderProps) {
	const [showHunkMenu, setShowHunkMenu] = useState(false);
	const fileName = fileDiff.name || fileDiff.prevName || 'unknown';
	const changeType = fileDiff.type;
	const hunks = fileDiff.hunks || [];

	const getIcon = (type: ChangeTypes) => {
		switch (type) {
			case 'new':
				return <VscDiffAdded className="w-4 h-4 text-green-500" />;
			case 'deleted':
				return <VscDiffRemoved className="w-4 h-4 text-red-500" />;
			case 'rename-pure':
			case 'rename-changed':
				return <VscFile className="w-4 h-4 text-yellow-500" />;
			default:
				return <VscDiffModified className="w-4 h-4 text-blue-500" />;
		}
	};

	const getLabel = (type: ChangeTypes) => {
		switch (type) {
			case 'new':
				return (
					<span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
						Added
					</span>
				);
			case 'deleted':
				return (
					<span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
						Deleted
					</span>
				);
			case 'rename-pure':
				return (
					<span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
						Renamed
					</span>
				);
			case 'rename-changed':
				return (
					<span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
						Renamed & Modified
					</span>
				);
			default:
				return null;
		}
	};

	const getHunkLabel = (hunk: Hunk, index: number) => {
		const context = hunk.hunkContext ? ` - ${hunk.hunkContext}` : '';
		return `Hunk ${index + 1}: Lines ${hunk.additionStart}-${hunk.additionStart + hunk.additionLines}${context}`;
	};

	return (
		<div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
			<div className="flex items-center gap-2 min-w-0">
				{getIcon(changeType)}
				<span className="font-mono text-sm truncate">{fileName}</span>
				{fileDiff.prevName && fileDiff.prevName !== fileName && (
					<span className="text-xs text-gray-500">
						← {fileDiff.prevName}
					</span>
				)}
				{getLabel(changeType)}
			</div>
			<div className="relative flex items-center gap-1">
				{hunks.length > 0 && (
					<div className="relative">
						<button
							onClick={() => setShowHunkMenu(!showHunkMenu)}
							className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
							title="Comment on hunk"
						>
							<VscComment className="w-3.5 h-3.5" />
							<span>Hunk ({hunks.length})</span>
						</button>
						{showHunkMenu && (
							<div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20">
								<div className="py-1 max-h-48 overflow-y-auto">
									{hunks.map((hunk, index) => (
										<button
											key={index}
											onClick={() => {
												onAddHunkComment(hunk, index);
												setShowHunkMenu(false);
											}}
											className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
										>
											{getHunkLabel(hunk, index)}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				)}
				<button
					onClick={onAddComment}
					className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
					title="Add file comment"
				>
					<VscComment className="w-3.5 h-3.5" />
					<span>File</span>
				</button>
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
	onSendNow,
}: DiffViewerProps) {
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	if (!rawDiff) {
		return (
			<div className="flex items-center justify-center h-full text-gray-500">
				No changes to display
			</div>
		);
	}

	if (!isClient) {
		return (
			<div className="flex items-center justify-center h-full text-gray-500">
				<div className="flex items-center gap-2">
					<div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
					Loading diff...
				</div>
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
			onSendNow={onSendNow}
		/>
	);
}
