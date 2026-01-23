import type { CommentFormData, SelectedLineRange } from './types';

export interface DiffViewerState {
	commentForm: CommentFormData | null;
	selectedLines: Map<string, SelectedLineRange | null>;
	expandedFiles: Set<string>;
	isInitialized: boolean;
	loadedFiles: Set<string>;
}

export type DiffViewerAction =
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

export function diffViewerReducer(
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

export const initialDiffViewerState: DiffViewerState = {
	commentForm: null,
	selectedLines: new Map(),
	expandedFiles: new Set(),
	isInitialized: false,
	loadedFiles: new Set(),
};
