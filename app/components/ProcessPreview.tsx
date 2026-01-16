import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import {
	VscCheck,
	VscChevronDown,
	VscChevronRight,
	VscClose,
} from 'react-icons/vsc';
import type { Comment } from '../services/comment.service';

interface ProcessPreviewProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	processedText: string;
	originalComments: Comment[];
	onConfirm: (processedText: string) => void;
	onCancel: () => void;
}

export function ProcessPreview({
	open,
	onOpenChange,
	processedText,
	originalComments,
	onConfirm,
	onCancel,
}: ProcessPreviewProps) {
	const [editedText, setEditedText] = useState(processedText);
	const [showOriginal, setShowOriginal] = useState(false);

	const handleConfirm = () => {
		onConfirm(editedText);
		onOpenChange(false);
	};

	const handleCancel = () => {
		onCancel();
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
				<Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl z-50 flex flex-col">
					<Dialog.Title className="text-lg font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
						Review Processed Comments
					</Dialog.Title>

					<div className="flex-1 overflow-y-auto p-4 space-y-4">
						{/* Processed output */}
						<div>
							<label className="block text-sm font-medium mb-2">
								Processed Output (editable)
							</label>
							<textarea
								value={editedText}
								onChange={(e) => setEditedText(e.target.value)}
								className="w-full h-48 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
							/>
						</div>

						{/* Original comments (collapsible) */}
						<div className="border border-gray-200 dark:border-gray-700 rounded">
							<button
								onClick={() => setShowOriginal(!showOriginal)}
								className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
							>
								{showOriginal ? (
									<VscChevronDown className="w-4 h-4" />
								) : (
									<VscChevronRight className="w-4 h-4" />
								)}
								Original Comments ({originalComments.length})
							</button>
							{showOriginal && (
								<div className="px-3 pb-3 space-y-2">
									{originalComments.map((comment) => (
										<div
											key={comment.id}
											className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
										>
											<div className="text-xs text-gray-500 mb-1">
												{comment.file_path}
												{comment.line_start &&
													`:${comment.line_start}`}
											</div>
											<div className="whitespace-pre-wrap">
												{comment.content}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
						<button
							onClick={handleCancel}
							className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
						>
							<VscClose className="w-4 h-4" />
							Cancel
						</button>
						<button
							onClick={handleConfirm}
							className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
						>
							<VscCheck className="w-4 h-4" />
							Stage Processed
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
