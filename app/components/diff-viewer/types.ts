import type { AnnotationSide, ParsedPatch } from '@pierre/diffs';
import type { Comment } from '../../services/comment.service';
import type { DiffFile } from '../file-explorer';

export type DiffStyle = 'split' | 'unified';

export interface SelectedLineRange {
	start: number;
	end: number;
	side?: AnnotationSide;
	endSide?: AnnotationSide;
}

export interface CommentFormData {
	filePath: string;
	lineStart?: number;
	lineEnd?: number;
	side: AnnotationSide;
	isFileComment?: boolean;
}

export interface HoveredLineResult {
	lineNumber: number;
	lineElement: HTMLElement;
	side: AnnotationSide;
}

export interface CommentFormAnnotation {
	type: 'comment-form';
	lineStart: number;
	lineEnd?: number;
}

export interface CommentIndicatorAnnotation {
	type: 'comment-indicator';
	comments: Comment[];
}

export type CommentAnnotation =
	| CommentFormAnnotation
	| CommentIndicatorAnnotation;

/** Map of file path -> line number -> comments at that line */
export type CommentMap = Map<string, Map<number, Comment[]>>;

export interface DiffViewerProps {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DiffComponentsType {
	FileDiff: React.ComponentType<any>;
	parsePatchFiles: (patch: string) => ParsedPatch[];
	defaultDiffOptions: Record<string, unknown>;
}
