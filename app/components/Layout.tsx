import { Text } from '@radix-ui/themes';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { VscCode } from 'react-icons/vsc';
import { GlobalLoadingBar } from './GlobalLoadingBar';

interface LayoutProps {
	children: ReactNode;
	leftSidebar?: ReactNode;
	rightSidebar?: ReactNode;
	header?: ReactNode;
	headerActions?: ReactNode;
}

const STORAGE_KEY_LEFT = 'pr-reviewer-left-panel-width';
const STORAGE_KEY_RIGHT = 'pr-reviewer-right-panel-width';
const MIN_LEFT = 180;
const MAX_LEFT = 400;
const DEFAULT_LEFT = 240;
const MIN_RIGHT = 260;
const MAX_RIGHT = 480;
const DEFAULT_RIGHT = 320;

function getStoredWidth(key: string, defaultVal: number): number {
	if (typeof window === 'undefined') return defaultVal;
	const stored = localStorage.getItem(key);
	if (stored) {
		const num = parseInt(stored, 10);
		if (!isNaN(num)) return num;
	}
	return defaultVal;
}

interface ResizeHandleProps {
	onResize: (delta: number) => void;
	position: 'left' | 'right';
}

function ResizeHandle({ onResize, position }: ResizeHandleProps) {
	const [isDragging, setIsDragging] = useState(false);
	const startXRef = useRef(0);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setIsDragging(true);
			startXRef.current = e.clientX;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const delta = moveEvent.clientX - startXRef.current;
				startXRef.current = moveEvent.clientX;
				onResize(position === 'left' ? delta : -delta);
			};

			const handleMouseUp = () => {
				setIsDragging(false);
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			};

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
		},
		[onResize, position],
	);

	return (
		<div
			className={`resize-handle ${position === 'left' ? 'right-0' : 'left-0'} ${isDragging ? 'resize-handle-active' : ''}`}
			onMouseDown={handleMouseDown}
			role="separator"
			aria-orientation="vertical"
			aria-label={`Resize ${position} panel`}
		/>
	);
}

export function Layout({
	children,
	leftSidebar,
	rightSidebar,
	header,
	headerActions,
}: LayoutProps) {
	const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
	const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);

	// Load stored widths on mount
	useEffect(() => {
		setLeftWidth(getStoredWidth(STORAGE_KEY_LEFT, DEFAULT_LEFT));
		setRightWidth(getStoredWidth(STORAGE_KEY_RIGHT, DEFAULT_RIGHT));
	}, []);

	const handleLeftResize = useCallback((delta: number) => {
		setLeftWidth((prev) => {
			const newWidth = Math.max(MIN_LEFT, Math.min(MAX_LEFT, prev + delta));
			localStorage.setItem(STORAGE_KEY_LEFT, String(newWidth));
			return newWidth;
		});
	}, []);

	const handleRightResize = useCallback((delta: number) => {
		setRightWidth((prev) => {
			const newWidth = Math.max(
				MIN_RIGHT,
				Math.min(MAX_RIGHT, prev + delta),
			);
			localStorage.setItem(STORAGE_KEY_RIGHT, String(newWidth));
			return newWidth;
		});
	}, []);

	return (
		<div className="h-screen flex flex-col">
			<GlobalLoadingBar />

			{/* Floating Header */}
			<header className="header-floating h-12 flex items-center justify-between px-4 shrink-0 sticky top-0 z-20">
				<div className="flex items-center gap-4">
					{/* Logo */}
					<div className="flex items-center gap-2">
						<VscCode className="w-5 h-5 text-zinc-500" />
						<Text size="3" weight="bold">
							PR Reviewer
						</Text>
					</div>
					{/* Breadcrumb / Header content */}
					{header && (
						<div className="breadcrumb">
							<span className="breadcrumb-separator">/</span>
							{header}
						</div>
					)}
				</div>
				<div className="flex items-center gap-2">{headerActions}</div>
			</header>

			{/* Small screen message */}
			<div className="flex md:hidden items-center justify-center flex-1 p-4 text-center">
				<Text color="gray">
					Please use a larger screen (tablet or desktop) for the best
					experience.
				</Text>
			</div>

			{/* Main content area - hidden on small screens */}
			<div className="hidden md:flex flex-1 overflow-hidden">
				{/* Left sidebar - File Explorer */}
				{leftSidebar && (
					<aside
						aria-label="File explorer"
						className="relative shrink-0 flex flex-col border-r"
						style={{
							width: leftWidth,
							borderColor: 'var(--color-border)',
						}}
					>
						<div className="flex-1 overflow-y-auto">
							{leftSidebar}
						</div>
						<ResizeHandle
							onResize={handleLeftResize}
							position="left"
						/>
					</aside>
				)}

				{/* Main content */}
				<main className="flex-1 overflow-auto">{children}</main>

				{/* Right sidebar - Comment Queue */}
				{rightSidebar && (
					<aside
						aria-label="Comment queue"
						className="relative shrink-0 overflow-y-auto border-l"
						style={{
							width: rightWidth,
							borderColor: 'var(--color-border)',
						}}
					>
						<ResizeHandle
							onResize={handleRightResize}
							position="right"
						/>
						{rightSidebar}
					</aside>
				)}
			</div>
		</div>
	);
}

// Simple layout without sidebars for landing page
export function SimpleLayout({ children }: { children: ReactNode }) {
	return (
		<div className="h-screen flex flex-col">
			<header className="header-floating h-12 flex items-center px-4 shrink-0 sticky top-0 z-20">
				<div className="flex items-center gap-2">
					<VscCode className="w-5 h-5 text-zinc-500" />
					<Text size="3" weight="bold">
						PR Reviewer
					</Text>
				</div>
			</header>
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	);
}
