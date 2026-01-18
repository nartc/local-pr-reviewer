import { Text } from '@radix-ui/themes';
import { useEffect, useMemo, useState } from 'react';
import {
	VscChevronDown,
	VscChevronRight,
	VscCode,
	VscEdit,
	VscFile,
	VscFolder,
	VscFolderOpened,
	VscJson,
	VscMarkdown,
	VscNewFile,
	VscSymbolMisc,
	VscTrash,
} from 'react-icons/vsc';

export interface DiffFile {
	path: string;
	status: 'added' | 'modified' | 'deleted' | 'renamed';
	additions: number;
	deletions: number;
	oldPath?: string;
}

interface FileExplorerProps {
	files: DiffFile[];
	selectedFile: string | null;
	onSelectFile: (path: string) => void;
}

interface FolderNode {
	name: string;
	path: string;
	files: DiffFile[];
	children: Map<string, FolderNode>;
	totalAdditions: number;
	totalDeletions: number;
}

const statusLabels = {
	added: 'A',
	modified: 'M',
	deleted: 'D',
	renamed: 'R',
};

const statusPillClasses = {
	added: 'status-pill status-pill-added',
	modified: 'status-pill status-pill-modified',
	deleted: 'status-pill status-pill-deleted',
	renamed: 'status-pill status-pill-renamed',
};

function getFileIcon(fileName: string) {
	const ext = fileName.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'json':
			return VscJson;
		case 'ts':
		case 'tsx':
		case 'js':
		case 'jsx':
			return VscCode;
		case 'md':
		case 'mdx':
			return VscMarkdown;
		case 'css':
		case 'scss':
		case 'less':
			return VscSymbolMisc;
		default:
			return VscFile;
	}
}

function getStatusIcon(status: DiffFile['status']) {
	switch (status) {
		case 'added':
			return VscNewFile;
		case 'deleted':
			return VscTrash;
		default:
			return VscEdit;
	}
}

function buildFolderTree(files: DiffFile[]): FolderNode {
	const root: FolderNode = {
		name: '',
		path: '',
		files: [],
		children: new Map(),
		totalAdditions: 0,
		totalDeletions: 0,
	};

	for (const file of files) {
		const parts = file.path.split('/');
		let current = root;

		for (let i = 0; i < parts.length - 1; i++) {
			const folderName = parts[i];
			const folderPath = parts.slice(0, i + 1).join('/');

			if (!current.children.has(folderName)) {
				current.children.set(folderName, {
					name: folderName,
					path: folderPath,
					files: [],
					children: new Map(),
					totalAdditions: 0,
					totalDeletions: 0,
				});
			}
			current = current.children.get(folderName)!;
		}

		current.files.push(file);
	}

	function calculateTotals(node: FolderNode): {
		additions: number;
		deletions: number;
	} {
		let additions = 0;
		let deletions = 0;

		for (const file of node.files) {
			additions += file.additions;
			deletions += file.deletions;
		}

		for (const child of node.children.values()) {
			const childTotals = calculateTotals(child);
			additions += childTotals.additions;
			deletions += childTotals.deletions;
		}

		node.totalAdditions = additions;
		node.totalDeletions = deletions;

		return { additions, deletions };
	}

	calculateTotals(root);
	return root;
}

export function FileExplorer({
	files,
	selectedFile,
	onSelectFile,
}: FileExplorerProps) {
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		new Set(['']),
	);

	const folderTree = useMemo(() => buildFolderTree(files), [files]);

	// Use useEffect for expanding all folders (side effect)
	useEffect(() => {
		const allFolders = new Set<string>(['']);
		function collectFolders(node: FolderNode) {
			allFolders.add(node.path);
			for (const child of node.children.values()) {
				collectFolders(child);
			}
		}
		collectFolders(folderTree);
		setExpandedFolders(allFolders);
	}, [folderTree]);

	const toggleFolder = (path: string) => {
		const newExpanded = new Set(expandedFolders);
		if (newExpanded.has(path)) {
			newExpanded.delete(path);
		} else {
			newExpanded.add(path);
		}
		setExpandedFolders(newExpanded);
	};

	const renderFolder = (
		node: FolderNode,
		depth: number = 0,
	): React.ReactNode => {
		const isExpanded = expandedFolders.has(node.path);
		const hasContent = node.files.length > 0 || node.children.size > 0;

		if (!hasContent && depth === 0) {
			return null;
		}

		const sortedChildren = Array.from(node.children.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		const sortedFiles = [...node.files].sort((a, b) => {
			const aName = a.path.split('/').pop() || '';
			const bName = b.path.split('/').pop() || '';
			return aName.localeCompare(bName);
		});

		const indent = depth * 16 + 12;

		return (
			<div key={node.path || 'root'} className="relative">
				{/* Tree indent guide */}
				{depth > 0 && (
					<div
						className="tree-indent-guide"
						style={{ left: indent - 8 }}
					/>
				)}

				{depth > 0 && (
					<button
						onClick={() => toggleFolder(node.path)}
						className="tree-item group"
						style={{ paddingLeft: indent }}
						role="treeitem"
						aria-expanded={isExpanded}
						title={node.path}
					>
						<span className="flex items-center gap-1.5 flex-1 min-w-0">
							{isExpanded ? (
								<VscChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
							) : (
								<VscChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
							)}
							{isExpanded ? (
								<VscFolderOpened className="w-4 h-4 text-amber-500 shrink-0" />
							) : (
								<VscFolder className="w-4 h-4 text-amber-500 shrink-0" />
							)}
							<Text
								size="2"
								weight="medium"
								className="truncate flex-1 text-left"
							>
								{node.name}
							</Text>
						</span>
						<span className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100">
							{node.totalAdditions > 0 && (
								<Text size="1" className="text-green-500">
									+{node.totalAdditions}
								</Text>
							)}
							{node.totalDeletions > 0 && (
								<Text size="1" className="text-red-500">
									-{node.totalDeletions}
								</Text>
							)}
						</span>
					</button>
				)}

				{(isExpanded || depth === 0) && (
					<div>
						{sortedChildren.map((child) =>
							renderFolder(child, depth + 1),
						)}

						{sortedFiles.map((file) => {
							const fileName =
								file.path.split('/').pop() || file.path;
							const StatusIcon = getStatusIcon(file.status);
							const FileIcon = getFileIcon(fileName);
							const isSelected = selectedFile === file.path;
							const fileIndent = (depth + 1) * 16 + 12;

							return (
								<button
									key={file.path}
									onClick={() => onSelectFile(file.path)}
									className={`tree-item group ${isSelected ? 'tree-item-selected' : ''}`}
									style={{ paddingLeft: fileIndent }}
									role="treeitem"
									aria-selected={isSelected}
									title={file.path}
								>
									<span className="flex items-center gap-1.5 flex-1 min-w-0">
										<StatusIcon
											className={`w-3.5 h-3.5 shrink-0 ${
												file.status === 'added'
													? 'text-green-500'
													: file.status === 'deleted'
														? 'text-red-500'
														: file.status ===
															  'renamed'
															? 'text-blue-500'
															: 'text-amber-500'
											}`}
											aria-hidden="true"
										/>
										<FileIcon
											className="w-4 h-4 shrink-0"
											style={{
												color: 'var(--color-text-muted)',
											}}
											aria-hidden="true"
										/>
										<Text
											size="2"
											className="truncate flex-1 text-left"
										>
											{fileName}
										</Text>
									</span>
									<span className="flex items-center gap-1.5 shrink-0">
										<span
											className={statusPillClasses[file.status]}
											aria-label={file.status}
										>
											{statusLabels[file.status]}
										</span>
										<span className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
											{file.additions > 0 && (
												<Text
													size="1"
													className="text-green-500"
												>
													+{file.additions}
												</Text>
											)}
											{file.deletions > 0 && (
												<Text
													size="1"
													className="text-red-500"
												>
													-{file.deletions}
												</Text>
											)}
										</span>
									</span>
								</button>
							);
						})}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="h-full flex flex-col">
			{/* Sticky header */}
			<div className="panel-header sticky top-0 z-10">
				<span>Changed Files ({files.length})</span>
				<span className="flex items-center gap-2">
					{folderTree.totalAdditions > 0 && (
						<Text size="1" className="text-green-500">
							+{folderTree.totalAdditions}
						</Text>
					)}
					{folderTree.totalDeletions > 0 && (
						<Text size="1" className="text-red-500">
							-{folderTree.totalDeletions}
						</Text>
					)}
				</span>
			</div>

			{/* File tree */}
			<div role="tree" aria-label="Changed files" className="flex-1 py-1">
				{renderFolder(folderTree)}
			</div>

			{/* Bottom summary */}
			<div
				className="px-4 py-2 text-xs border-t"
				style={{
					borderColor: 'var(--color-border)',
					color: 'var(--color-text-muted)',
				}}
			>
				{files.length} file{files.length !== 1 ? 's' : ''} changed
			</div>
		</div>
	);
}
