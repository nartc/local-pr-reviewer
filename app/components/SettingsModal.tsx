import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { VscCheck, VscSettingsGear } from 'react-icons/vsc';
import { useTheme } from '../lib/theme.js';

type DiffStyle = 'split' | 'unified';

interface SettingsModalProps {
	diffStyle: DiffStyle;
	onDiffStyleChange: (style: DiffStyle) => void;
}

export function SettingsModal({
	diffStyle,
	onDiffStyleChange,
}: SettingsModalProps) {
	const [open, setOpen] = useState(false);
	const { theme, setTheme } = useTheme();
	const [localDiffStyle, setLocalDiffStyle] = useState(diffStyle);

	useEffect(() => {
		setLocalDiffStyle(diffStyle);
	}, [diffStyle]);

	const handleSave = () => {
		onDiffStyleChange(localDiffStyle);
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger asChild>
				<button
					className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
					title="Settings"
				>
					<VscSettingsGear className="w-5 h-5" />
				</button>
			</Dialog.Trigger>

			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
				<Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-lg shadow-xl z-50 p-6">
					<Dialog.Title className="text-lg font-semibold mb-6">
						Settings
					</Dialog.Title>

					<div className="space-y-6">
						{/* Theme */}
						<div>
							<label className="block text-sm font-medium mb-3">
								Theme
							</label>
							<div className="flex gap-2">
								{(['light', 'dark', 'system'] as const).map(
									(t) => (
										<button
											key={t}
											onClick={() => setTheme(t)}
											className={`flex-1 px-3 py-2 text-sm rounded border transition-colors capitalize ${
												theme === t
													? 'bg-blue-500 text-white border-blue-500'
													: 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
											}`}
										>
											{t}
										</button>
									),
								)}
							</div>
						</div>

						{/* Diff Style */}
						<div>
							<label className="block text-sm font-medium mb-3">
								Diff View
							</label>
							<div className="flex gap-2">
								<button
									onClick={() => setLocalDiffStyle('split')}
									className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
										localDiffStyle === 'split'
											? 'bg-blue-500 text-white border-blue-500'
											: 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
									}`}
								>
									Split View
								</button>
								<button
									onClick={() => setLocalDiffStyle('unified')}
									className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
										localDiffStyle === 'unified'
											? 'bg-blue-500 text-white border-blue-500'
											: 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
									}`}
								>
									Unified View
								</button>
							</div>
						</div>

						{/* Keyboard Shortcuts */}
						<div>
							<label className="block text-sm font-medium mb-3">
								Keyboard Shortcuts
							</label>
							<div className="text-sm text-gray-500 space-y-2">
								<div className="flex justify-between">
									<span>Close modal / Cancel</span>
									<kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
										Esc
									</kbd>
								</div>
								<div className="flex justify-between">
									<span>Submit / Queue comment</span>
									<kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
										⌘ + Enter
									</kbd>
								</div>
								<div className="flex justify-between">
									<span>Navigate down</span>
									<kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
										j
									</kbd>
								</div>
								<div className="flex justify-between">
									<span>Navigate up</span>
									<kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
										k
									</kbd>
								</div>
							</div>
						</div>
					</div>

					<div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
						<Dialog.Close asChild>
							<button className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
								Cancel
							</button>
						</Dialog.Close>
						<button
							onClick={handleSave}
							className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
						>
							<VscCheck className="w-4 h-4" />
							Save
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
