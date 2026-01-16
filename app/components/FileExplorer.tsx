import { useMemo, useState } from 'react';
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

const statusIcons = {
	added: VscNewFile,
	modified: VscEdit,
	deleted: VscTrash,
	renamed: VscEdit,
};

const statusColors = {
	added: 'text-green-500',
	modified: 'text-yellow-500',
	deleted: 'text-red-500',
	renamed: 'text-blue-500',
};

// Get file icon based on extension
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

// Build folder tree from flat file list
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

		// Navigate/create folder structure
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

		// Add file to current folder
		current.files.push(file);
	}

	// Calculate totals recursively
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

	// Expand all folders by default
	useMemo(() => {
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

		return (
			<div key={node.path || 'root'}>
				{/* Folder header (skip for root) */}
				{depth > 0 && (
					<button
						onClick={() => toggleFolder(node.path)}
						className="w-full px-2 py-1.5 flex items-center gap-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						style={{ paddingLeft: `${depth * 12 + 8}px` }}
					>
						{isExpanded ? (
							<VscChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
						) : (
							<VscChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
						)}
						{isExpanded ? (
							<VscFolderOpened className="w-4 h-4 text-yellow-500 shrink-0" />
						) : (
							<VscFolder className="w-4 h-4 text-yellow-500 shrink-0" />
						)}
						<span className="text-sm font-medium truncate flex-1">
							{node.name}
						</span>
						<div className="flex items-center gap-1 text-xs shrink-0">
							{node.totalAdditions > 0 && (
								<span className="text-green-500">
									+{node.totalAdditions}
								</span>
							)}
							{node.totalDeletions > 0 && (
								<span className="text-red-500">
									-{node.totalDeletions}
								</span>
							)}
						</div>
					</button>
				)}

				{/* Folder contents */}
				{(isExpanded || depth === 0) && (
					<>
						{/* Subfolders */}
						{sortedChildren.map((child) =>
							renderFolder(child, depth + 1),
						)}

						{/* Files */}
						{sortedFiles.map((file) => {
							const fileName =
								file.path.split('/').pop() || file.path;
							const StatusIcon = statusIcons[file.status];
							const FileIcon = getFileIcon(fileName);
							const colorClass = statusColors[file.status];

							return (
								<button
									key={file.path}
									onClick={() => onSelectFile(file.path)}
									className={`w-full px-2 py-1.5 flex items-center gap-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
										selectedFile === file.path
											? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500'
											: ''
									}`}
									style={{
										paddingLeft: `${(depth + 1) * 12 + 8}px`,
									}}
								>
									<StatusIcon
										className={`w-3 h-3 shrink-0 ${colorClass}`}
									/>
									<FileIcon className="w-4 h-4 text-gray-400 shrink-0" />
									<span className="text-sm truncate flex-1">
										{fileName}
									</span>
									<div className="flex items-center gap-1 text-xs shrink-0">
										{file.additions > 0 && (
											<span className="text-green-500">
												+{file.additions}
											</span>
										)}
										{file.deletions > 0 && (
											<span className="text-red-500">
												-{file.deletions}
											</span>
										)}
									</div>
								</button>
							);
						})}
					</>
				)}
			</div>
		);
	};

	return (
		<div className="py-2">
			<div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
				<span>Changed Files ({files.length})</span>
				<div className="flex items-center gap-1 normal-case font-normal">
					{folderTree.totalAdditions > 0 && (
						<span className="text-green-500">
							+{folderTree.totalAdditions}
						</span>
					)}
					{folderTree.totalDeletions > 0 && (
						<span className="text-red-500">
							-{folderTree.totalDeletions}
						</span>
					)}
				</div>
			</div>
			{renderFolder(folderTree)}
		</div>
	);
}
