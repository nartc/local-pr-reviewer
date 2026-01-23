import {
	Button,
	Dialog,
	IconButton,
	Kbd,
	SegmentedControl,
	Text,
	TextField,
	Tooltip,
} from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { VscCheck, VscSettingsGear } from 'react-icons/vsc';
import { useTheme } from '../lib/theme';

type DiffStyle = 'split' | 'unified';

// Default threshold for auto-collapsing large files
const DEFAULT_LARGE_FILE_THRESHOLD = 500;

interface SettingsModalProps {
	diffStyle: DiffStyle;
	onDiffStyleChange: (style: DiffStyle) => void;
	largeFileThreshold: number;
	onLargeFileThresholdChange: (threshold: number) => void;
}

export function SettingsModal({
	diffStyle,
	onDiffStyleChange,
	largeFileThreshold,
	onLargeFileThresholdChange,
}: SettingsModalProps) {
	const [open, setOpen] = useState(false);
	const { theme, setTheme, density, setDensity } = useTheme();
	const [localDiffStyle, setLocalDiffStyle] = useState(diffStyle);
	const [localThreshold, setLocalThreshold] = useState(
		String(largeFileThreshold),
	);

	useEffect(() => {
		setLocalDiffStyle(diffStyle);
	}, [diffStyle]);

	useEffect(() => {
		setLocalThreshold(String(largeFileThreshold));
	}, [largeFileThreshold]);

	const handleSave = () => {
		onDiffStyleChange(localDiffStyle);
		const parsedThreshold = parseInt(localThreshold, 10);
		if (!isNaN(parsedThreshold) && parsedThreshold >= 0) {
			onLargeFileThresholdChange(parsedThreshold);
		}
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Tooltip content="Settings">
				<Dialog.Trigger>
					<IconButton
						variant="ghost"
						aria-label="Settings"
						className="btn-press"
					>
						<VscSettingsGear aria-hidden="true" />
					</IconButton>
				</Dialog.Trigger>
			</Tooltip>

			<Dialog.Content maxWidth="450px">
				<Dialog.Title>Settings</Dialog.Title>

				<div className="flex flex-col gap-6 mt-4">
					{/* Theme */}
					<div className="flex flex-col gap-3">
						<Text
							size="2"
							weight="medium"
							className="text-theme-primary"
						>
							Theme
						</Text>
						<SegmentedControl.Root
							value={theme}
							onValueChange={(v) => setTheme(v as typeof theme)}
							className="w-full"
						>
							<SegmentedControl.Item value="light">
								Light
							</SegmentedControl.Item>
							<SegmentedControl.Item value="dark">
								Dark
							</SegmentedControl.Item>
							<SegmentedControl.Item value="system">
								System
							</SegmentedControl.Item>
						</SegmentedControl.Root>
					</div>

					{/* Diff Style */}
					<div className="flex flex-col gap-3">
						<Text
							size="2"
							weight="medium"
							className="text-theme-primary"
						>
							Diff View
						</Text>
						<SegmentedControl.Root
							value={localDiffStyle}
							onValueChange={(v) =>
								setLocalDiffStyle(v as DiffStyle)
							}
							className="w-full"
						>
							<SegmentedControl.Item value="split">
								Split View
							</SegmentedControl.Item>
							<SegmentedControl.Item value="unified">
								Unified View
							</SegmentedControl.Item>
						</SegmentedControl.Root>
					</div>

					{/* Density */}
					<div className="flex flex-col gap-3">
						<Text
							size="2"
							weight="medium"
							className="text-theme-primary"
						>
							UI Density
						</Text>
						<SegmentedControl.Root
							value={density}
							onValueChange={(v) =>
								setDensity(v as typeof density)
							}
							className="w-full"
						>
							<SegmentedControl.Item value="normal">
								Normal
							</SegmentedControl.Item>
							<SegmentedControl.Item value="compact">
								Compact
							</SegmentedControl.Item>
						</SegmentedControl.Root>
					</div>

					{/* Large File Threshold */}
					<div className="flex flex-col gap-3">
						<Text
							size="2"
							weight="medium"
							className="text-theme-primary"
						>
							Auto-collapse Threshold
						</Text>
						<Text size="1" className="text-theme-secondary">
							Files with more than this many changed lines will be
							collapsed by default. Lock files are always
							collapsed.
						</Text>
						<TextField.Root
							type="number"
							min="0"
							value={localThreshold}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>,
							) => setLocalThreshold(e.target.value)}
							placeholder={String(DEFAULT_LARGE_FILE_THRESHOLD)}
						/>
					</div>

					{/* Keyboard Shortcuts */}
					<div className="flex flex-col gap-3">
						<Text
							size="2"
							weight="medium"
							className="text-theme-primary"
						>
							Keyboard Shortcuts
						</Text>
						<div className="flex flex-col gap-2 p-3 rounded-lg bg-theme-surface">
							<div className="flex justify-between items-center">
								<Text size="2" className="text-theme-secondary">
									Close modal / Cancel
								</Text>
								<Kbd>Esc</Kbd>
							</div>
							<div className="flex justify-between items-center">
								<Text size="2" className="text-theme-secondary">
									Submit / Queue comment
								</Text>
								<Kbd>⌘ + Enter</Kbd>
							</div>
							<div className="flex justify-between items-center">
								<Text size="2" className="text-theme-secondary">
									Navigate down
								</Text>
								<Kbd>j</Kbd>
							</div>
							<div className="flex justify-between items-center">
								<Text size="2" className="text-theme-secondary">
									Navigate up
								</Text>
								<Kbd>k</Kbd>
							</div>
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 pt-4 theme-divider">
					<Dialog.Close>
						<Button
							variant="soft"
							color="gray"
							className="btn-press"
						>
							Cancel
						</Button>
					</Dialog.Close>
					<Button onClick={handleSave} className="btn-press">
						<VscCheck aria-hidden="true" />
						Save
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
