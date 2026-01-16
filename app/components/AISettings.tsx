import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { VscCheck, VscSettings } from 'react-icons/vsc';

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
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (open) {
			fetchSettings();
		}
	}, [open]);

	const fetchSettings = async () => {
		try {
			const res = await fetch('/api/process');
			const data = await res.json();
			setAvailableProviders(data.availableProviders);
			setProviderModels(data.providerModels);
			if (data.currentSettings.provider) {
				setSelectedProvider(data.currentSettings.provider);
				setSelectedModel(data.currentSettings.model);
			} else if (data.availableProviders.length > 0) {
				// Default to first available provider
				const defaultProvider = data.availableProviders[0];
				setSelectedProvider(defaultProvider);
				setSelectedModel(
					data.providerModels[defaultProvider]?.[0] || null,
				);
			}
		} catch (error) {
			console.error('Failed to fetch AI settings:', error);
		}
	};

	const handleSave = async () => {
		if (!selectedProvider || !selectedModel) return;

		setSaving(true);
		try {
			await fetch('/api/process', {
				method: 'POST',
				body: new URLSearchParams({
					intent: 'saveSettings',
					provider: selectedProvider,
					model: selectedModel,
				}),
			});
			setOpen(false);
			onSettingsChange?.();
		} catch (error) {
			console.error('Failed to save AI settings:', error);
		}
		setSaving(false);
	};

	const handleProviderChange = (provider: AIProvider) => {
		setSelectedProvider(provider);
		// Select first model for the new provider
		setSelectedModel(providerModels[provider]?.[0] || null);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger asChild>
				<button
					className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
					title="AI Settings"
				>
					<VscSettings className="w-4 h-4" />
				</button>
			</Dialog.Trigger>

			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
				<Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-lg shadow-xl z-50 p-6">
					<Dialog.Title className="text-lg font-semibold mb-4">
						AI Settings
					</Dialog.Title>

					{availableProviders.length === 0 ? (
						<div className="text-sm text-gray-500 py-4">
							<p className="mb-2">No AI providers configured.</p>
							<p>Set one of these environment variables:</p>
							<ul className="list-disc list-inside mt-2 space-y-1">
								<li>GOOGLE_API_KEY</li>
								<li>OPENAI_API_KEY</li>
								<li>ANTHROPIC_API_KEY</li>
							</ul>
						</div>
					) : (
						<div className="space-y-4">
							{/* Provider selection */}
							<div>
								<label className="block text-sm font-medium mb-2">
									Provider
								</label>
								<div className="flex flex-wrap gap-2">
									{availableProviders.map((provider) => (
										<button
											key={provider}
											onClick={() =>
												handleProviderChange(provider)
											}
											className={`px-3 py-1.5 text-sm rounded border transition-colors ${
												selectedProvider === provider
													? 'bg-blue-500 text-white border-blue-500'
													: 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
											}`}
										>
											{provider}
										</button>
									))}
								</div>
							</div>

							{/* Model selection */}
							{selectedProvider &&
								providerModels[selectedProvider] && (
									<div>
										<label className="block text-sm font-medium mb-2">
											Model
										</label>
										<select
											value={selectedModel || ''}
											onChange={(e) =>
												setSelectedModel(e.target.value)
											}
											className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
										>
											{providerModels[
												selectedProvider
											].map((model) => (
												<option
													key={model}
													value={model}
												>
													{model}
												</option>
											))}
										</select>
									</div>
								)}
						</div>
					)}

					{/* Actions */}
					<div className="flex justify-end gap-2 mt-6">
						<Dialog.Close asChild>
							<button className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
								Cancel
							</button>
						</Dialog.Close>
						{availableProviders.length > 0 && (
							<button
								onClick={handleSave}
								disabled={
									!selectedProvider ||
									!selectedModel ||
									saving
								}
								className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<VscCheck className="w-4 h-4" />
								{saving ? 'Saving...' : 'Save'}
							</button>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
