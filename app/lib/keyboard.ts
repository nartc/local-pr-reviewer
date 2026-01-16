import { useEffect } from 'react';

type KeyboardHandler = (event: KeyboardEvent) => void;

interface KeyboardShortcut {
	key: string;
	ctrl?: boolean;
	meta?: boolean;
	shift?: boolean;
	alt?: boolean;
	handler: KeyboardHandler;
	description: string;
}

// Global keyboard shortcuts registry
const shortcuts: KeyboardShortcut[] = [];

export function registerShortcut(shortcut: KeyboardShortcut) {
	shortcuts.push(shortcut);
	return () => {
		const index = shortcuts.indexOf(shortcut);
		if (index > -1) {
			shortcuts.splice(index, 1);
		}
	};
}

// Check if an element is an input/textarea
function isInputElement(element: EventTarget | null): boolean {
	if (!element || !(element instanceof HTMLElement)) return false;
	const tagName = element.tagName.toLowerCase();
	return (
		tagName === 'input' ||
		tagName === 'textarea' ||
		element.isContentEditable
	);
}

// Global keyboard event handler
function handleKeyDown(event: KeyboardEvent) {
	// Don't handle shortcuts when typing in inputs
	if (isInputElement(event.target)) {
		// Allow Escape in inputs
		if (event.key !== 'Escape') {
			return;
		}
	}

	for (const shortcut of shortcuts) {
		const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
		const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
		const metaMatch = !!shortcut.meta === event.metaKey;
		const shiftMatch = !!shortcut.shift === event.shiftKey;
		const altMatch = !!shortcut.alt === event.altKey;

		if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
			event.preventDefault();
			shortcut.handler(event);
			return;
		}
	}
}

// Hook to set up global keyboard listener
export function useGlobalKeyboard() {
	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, []);
}

// Hook to register a keyboard shortcut
export function useKeyboardShortcut(
	key: string,
	handler: KeyboardHandler,
	options: {
		ctrl?: boolean;
		meta?: boolean;
		shift?: boolean;
		alt?: boolean;
		description?: string;
		enabled?: boolean;
	} = {},
) {
	const {
		ctrl,
		meta,
		shift,
		alt,
		description = '',
		enabled = true,
	} = options;

	useEffect(() => {
		if (!enabled) return;

		const shortcut: KeyboardShortcut = {
			key,
			ctrl,
			meta,
			shift,
			alt,
			handler,
			description,
		};

		return registerShortcut(shortcut);
	}, [key, ctrl, meta, shift, alt, handler, description, enabled]);
}

// Common shortcuts
export function useEscapeKey(handler: () => void, enabled = true) {
	useKeyboardShortcut('Escape', handler, {
		description: 'Close/Cancel',
		enabled,
	});
}

export function useSubmitShortcut(handler: () => void, enabled = true) {
	useKeyboardShortcut('Enter', handler, {
		meta: true,
		description: 'Submit',
		enabled,
	});
}

// Navigation shortcuts (j/k for up/down)
export function useNavigationShortcuts(
	onNext: () => void,
	onPrevious: () => void,
	enabled = true,
) {
	useKeyboardShortcut('j', onNext, {
		description: 'Next item',
		enabled,
	});
	useKeyboardShortcut('k', onPrevious, {
		description: 'Previous item',
		enabled,
	});
}

// Get all registered shortcuts for help display
export function getRegisteredShortcuts(): KeyboardShortcut[] {
	return [...shortcuts];
}

// Format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
	const parts: string[] = [];
	if (shortcut.ctrl) parts.push('Ctrl');
	if (shortcut.meta) parts.push('⌘');
	if (shortcut.shift) parts.push('Shift');
	if (shortcut.alt) parts.push('Alt');
	parts.push(shortcut.key.toUpperCase());
	return parts.join('+');
}
