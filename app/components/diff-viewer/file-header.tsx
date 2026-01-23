import type { ChangeTypes, FileDiffMetadata, Hunk } from '@pierre/diffs';
import {
	Badge,
	Button,
	DropdownMenu,
	IconButton,
	Tooltip,
} from '@radix-ui/themes';
import { memo } from 'react';
import {
	VscChevronDown,
	VscChevronRight,
	VscComment,
	VscDiffAdded,
	VscDiffModified,
	VscDiffRemoved,
	VscFile,
} from 'react-icons/vsc';
import { getActualChangedLineRange } from './utils';

interface StickyFileHeaderProps {
	fileDiff: FileDiffMetadata;
	isExpanded: boolean;
	onToggleExpanded: () => void;
	onAddComment: () => void;
	onAddHunkComment: (hunk: Hunk, hunkIndex: number) => void;
}

export const StickyFileHeader = memo(function StickyFileHeader({
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
					<span className="text-sm font-medium font-mono truncate">
						{fileName}
					</span>
					{fileDiff.prevName && fileDiff.prevName !== fileName && (
						<span className="text-xs shrink-0 text-theme-muted">
							{'<-'} {fileDiff.prevName}
						</span>
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
