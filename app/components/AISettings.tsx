import {
	Button,
	Dialog,
	IconButton,
	SegmentedControl,
	Select,
	Spinner,
	Text,
	Tooltip,
} from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { VscCheck, VscSettings } from 'react-icons/vsc';
import { useAsyncAction } from '../lib/use-async-action';

type AIProvider = 'google' | 'openai' | 'anthropic';

interface AISettingsProps {
	onSettingsChange?: () => void;
}

export function AISettings({ onSettingsChange }: AISettingsProps) {
	const [open, setOpen] = useState(false);
	const [availableProviders, setAvailableProviders] = useState<AIProvider[]>(
		[],
	);
	const [providerModels, setProviderModels] = useState<
		Record<string, string[]>
	>({});
	const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
		null,
	);
	const [selectedModel, setSelectedModel] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const { submit, isPending: saving } = useAsyncAction({
		successMessage: 'AI settings saved',
		onSuccess: () => {
			setOpen(false);
			onSettingsChange?.();
		},
	});

	useEffect(() => {
		if (open) {
			fetchSettings();
		}
	}, [open]);

	const fetchSettings = async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/process');
			const data = await res.json();
			setAvailableProviders(data.availableProviders);
			setProviderModels(data.providerModels);
			if (data.currentSettings.provider) {
				setSelectedProvider(data.currentSettings.provider);
				setSelectedModel(data.currentSettings.model);
			} else if (data.availableProviders.length > 0) {
				const defaultProvider = data.availableProviders[0];
				setSelectedProvider(defaultProvider);
				setSelectedModel(
					data.providerModels[defaultProvider]?.[0] || null,
				);
			}
		} catch (error) {
			console.error('Failed to fetch AI settings:', error);
		}
		setLoading(false);
	};

	const handleSave = () => {
		if (!selectedProvider || !selectedModel) return;
		submit(
			{
				intent: 'saveSettings',
				provider: selectedProvider,
				model: selectedModel,
			},
			{ method: 'POST', action: '/api/process' },
		);
	};

	const handleProviderChange = (provider: string) => {
		setSelectedProvider(provider as AIProvider);
		setSelectedModel(providerModels[provider]?.[0] || null);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Tooltip content="AI Settings">
				<Dialog.Trigger>
					<IconButton variant="ghost" aria-label="AI Settings">
						<VscSettings aria-hidden="true" />
					</IconButton>
				</Dialog.Trigger>
			</Tooltip>

			<Dialog.Content maxWidth="400px">
				<Dialog.Title>AI Settings</Dialog.Title>

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Spinner size="3" />
					</div>
				) : availableProviders.length === 0 ? (
					<div className="py-4">
						<Text size="2" color="gray">
							No AI providers configured. Set one of these
							environment variables:
						</Text>
						<ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-500">
							<li>GOOGLE_API_KEY</li>
							<li>OPENAI_API_KEY</li>
							<li>ANTHROPIC_API_KEY</li>
						</ul>
					</div>
				) : (
					<div className="space-y-4 mt-4">
						{/* Provider selection */}
						<div>
							<Text
								size="2"
								weight="medium"
								className="mb-2 block"
							>
								Provider
							</Text>
							<SegmentedControl.Root
								value={selectedProvider || ''}
								onValueChange={handleProviderChange}
							>
								{availableProviders.map((provider) => (
									<SegmentedControl.Item
										key={provider}
										value={provider}
									>
										{provider}
									</SegmentedControl.Item>
								))}
							</SegmentedControl.Root>
						</div>

						{/* Model selection */}
						{selectedProvider &&
							providerModels[selectedProvider] && (
								<div>
									<Text
										size="2"
										weight="medium"
										className="mb-2 block"
									>
										Model
									</Text>
									<Select.Root
										value={selectedModel || ''}
										onValueChange={setSelectedModel}
									>
										<Select.Trigger className="w-full" />
										<Select.Content>
											{providerModels[
												selectedProvider
											].map((model) => (
												<Select.Item
													key={model}
													value={model}
												>
													{model}
												</Select.Item>
											))}
										</Select.Content>
									</Select.Root>
								</div>
							)}
					</div>
				)}

				{/* Actions */}
				<div className="flex justify-end gap-2 mt-6">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							Cancel
						</Button>
					</Dialog.Close>
					{availableProviders.length > 0 && (
						<Button
							onClick={handleSave}
							disabled={
								!selectedProvider || !selectedModel || saving
							}
						>
							<VscCheck aria-hidden="true" />
							{saving ? 'Saving...' : 'Save'}
						</Button>
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
