import type { AnnotationSide, FileDiffMetadata } from '@pierre/diffs';
import { useEffect } from 'react';
import { InlineCommentForm } from '../inline-comment-form';
import { GutterCommentBadge, HoverAddCommentButton } from './comments';
import type {
	CommentAnnotation,
	CommentFormAnnotation,
	CommentFormData,
	CommentIndicatorAnnotation,
	DiffComponentsType,
	DiffStyle,
	HoveredLineResult,
	SelectedLineRange,
} from './types';

export interface FileDiffWrapperProps {
	FileDiff: DiffComponentsType['FileDiff'];
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

export function FileDiffWrapper({
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
