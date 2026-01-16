import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, type ReactNode } from 'react';
import { VscChevronLeft, VscChevronRight, VscColorMode } from 'react-icons/vsc';
import { useTheme } from '../lib/theme.js';

interface LayoutProps {
	children: ReactNode;
	leftSidebar?: ReactNode;
	rightSidebar?: ReactNode;
	header?: ReactNode;
	headerActions?: ReactNode;
}

export function Layout({
	children,
	leftSidebar,
	rightSidebar,
	header,
	headerActions,
}: LayoutProps) {
	const [leftCollapsed, setLeftCollapsed] = useState(true);

	return (
		<div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
			{/* Header */}
			<header className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shrink-0">
				<div className="flex items-center gap-4">
					<h1 className="text-lg font-semibold">PR Reviewer</h1>
					{header}
				</div>
				<div className="flex items-center gap-2">
					{headerActions}
					<ThemeToggle />
				</div>
			</header>

			{/* Main content area */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left sidebar */}
				{leftSidebar && (
					<aside
						className={`border-r border-gray-200 dark:border-gray-800 shrink-0 flex flex-col transition-all duration-200 ${
							leftCollapsed ? 'w-10' : 'w-64'
						}`}
					>
						{/* Collapse toggle */}
						<button
							onClick={() => setLeftCollapsed(!leftCollapsed)}
							className="h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-800"
							title={
								leftCollapsed
									? 'Expand files'
									: 'Collapse files'
							}
						>
							{leftCollapsed ? (
								<VscChevronRight className="w-4 h-4" />
							) : (
								<VscChevronLeft className="w-4 h-4" />
							)}
						</button>
						{/* Sidebar content */}
						<div
							className={`flex-1 overflow-y-auto ${leftCollapsed ? 'hidden' : ''}`}
						>
							{leftSidebar}
						</div>
					</aside>
				)}

				{/* Main content */}
				<main className="flex-1 overflow-auto">{children}</main>

				{/* Right sidebar */}
				{rightSidebar && (
					<aside className="w-80 border-l border-gray-200 dark:border-gray-800 overflow-y-auto shrink-0">
						{rightSidebar}
					</aside>
				)}
			</div>
		</div>
	);
}

function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button
					className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					aria-label="Toggle theme"
				>
					<VscColorMode className="w-5 h-5" />
				</button>
			</DropdownMenu.Trigger>

			<DropdownMenu.Portal>
				<DropdownMenu.Content
					className="min-w-[120px] bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50"
					sideOffset={5}
					align="end"
				>
					<DropdownMenu.Item
						className={`px-3 py-2 text-sm rounded cursor-pointer outline-none ${
							theme === 'light'
								? 'bg-gray-100 dark:bg-gray-800'
								: 'hover:bg-gray-100 dark:hover:bg-gray-800'
						}`}
						onSelect={() => setTheme('light')}
					>
						Light
					</DropdownMenu.Item>
					<DropdownMenu.Item
						className={`px-3 py-2 text-sm rounded cursor-pointer outline-none ${
							theme === 'dark'
								? 'bg-gray-100 dark:bg-gray-800'
								: 'hover:bg-gray-100 dark:hover:bg-gray-800'
						}`}
						onSelect={() => setTheme('dark')}
					>
						Dark
					</DropdownMenu.Item>
					<DropdownMenu.Item
						className={`px-3 py-2 text-sm rounded cursor-pointer outline-none ${
							theme === 'system'
								? 'bg-gray-100 dark:bg-gray-800'
								: 'hover:bg-gray-100 dark:hover:bg-gray-800'
						}`}
						onSelect={() => setTheme('system')}
					>
						System
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

// Simple layout without sidebars for landing page
export function SimpleLayout({ children }: { children: ReactNode }) {
	return (
		<div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
			<header className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shrink-0">
				<h1 className="text-lg font-semibold">PR Reviewer</h1>
				<ThemeToggle />
			</header>
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	);
}
