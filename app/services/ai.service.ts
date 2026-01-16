import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { Comment } from './comment.service';
import { getDatabase } from './db.service';

// Provider configuration
type AIProvider = 'google' | 'openai' | 'anthropic';

interface ProviderConfig {
	name: AIProvider;
	models: string[];
	createClient: () =>
		| ReturnType<typeof createGoogleGenerativeAI>
		| ReturnType<typeof createOpenAI>
		| ReturnType<typeof createAnthropic>;
	envKey: string;
}

const providers: ProviderConfig[] = [
	{
		name: 'google',
		models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
		createClient: () =>
			createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY }),
		envKey: 'GOOGLE_API_KEY',
	},
	{
		name: 'openai',
		models: ['gpt-4o-mini', 'gpt-4o'],
		createClient: () =>
			createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
		envKey: 'OPENAI_API_KEY',
	},
	{
		name: 'anthropic',
		models: ['claude-3-5-sonnet-latest'],
		createClient: () =>
			createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
		envKey: 'ANTHROPIC_API_KEY',
	},
];

// Fallback chain order (cheapest/fastest first)
const fallbackChain = [
	{ provider: 'google', model: 'gemini-1.5-flash' },
	{ provider: 'openai', model: 'gpt-4o-mini' },
	{ provider: 'google', model: 'gemini-1.5-pro' },
	{ provider: 'openai', model: 'gpt-4o' },
	{ provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
] as const;

// Processing prompt
const PROCESSING_PROMPT = `You are a code review assistant. Your task is to process and improve code review comments.

Given a list of comments about code changes, please:
1. Remove any duplicate or redundant comments
2. Combine related comments that address the same issue
3. Prioritize comments by importance (critical issues first, then improvements, then style)
4. Improve clarity and actionability of each comment
5. Keep the file path and line number context

Format your response as a list of improved comments, each with:
- File path and line number (if applicable)
- The improved comment text

Be concise but thorough. Focus on actionable feedback.`;

// AI service
export const aiService = {
	// Get available providers
	getAvailableProviders: (): AIProvider[] => {
		return providers
			.filter((p) => process.env[p.envKey])
			.map((p) => p.name);
	},

	// Get current AI settings from app_config
	getSettings: (): { provider: AIProvider | null; model: string | null } => {
		const db = getDatabase();
		const providerRow = db
			.prepare("SELECT value FROM app_config WHERE key = 'ai_provider'")
			.get() as { value: string } | undefined;
		const modelRow = db
			.prepare("SELECT value FROM app_config WHERE key = 'ai_model'")
			.get() as { value: string } | undefined;

		return {
			provider: (providerRow?.value as AIProvider) || null,
			model: modelRow?.value || null,
		};
	},

	// Save AI settings
	saveSettings: (provider: AIProvider, model: string): void => {
		const db = getDatabase();
		db.prepare(
			"INSERT OR REPLACE INTO app_config (key, value) VALUES ('ai_provider', ?)",
		).run(provider);
		db.prepare(
			"INSERT OR REPLACE INTO app_config (key, value) VALUES ('ai_model', ?)",
		).run(model);
	},

	// Process comments with AI
	processComments: async (comments: Comment[]): Promise<string> => {
		if (comments.length === 0) {
			return '';
		}

		// Format comments for the prompt
		const commentsText = comments
			.map((c) => {
				const lineInfo = c.line_start ? `:${c.line_start}` : '';
				return `**${c.file_path}${lineInfo}**\n${c.content}`;
			})
			.join('\n\n---\n\n');

		const prompt = `${PROCESSING_PROMPT}\n\n## Comments to process:\n\n${commentsText}`;

		// Try user-configured provider first
		const settings = aiService.getSettings();
		if (settings.provider && settings.model) {
			try {
				const result = await aiService.generateWithProvider(
					settings.provider,
					settings.model,
					prompt,
				);
				if (result) return result;
			} catch (error) {
				console.warn(
					`Configured provider ${settings.provider} failed, trying fallback chain`,
				);
			}
		}

		// Try fallback chain
		for (const { provider, model } of fallbackChain) {
			const providerConfig = providers.find((p) => p.name === provider);
			if (!providerConfig || !process.env[providerConfig.envKey]) {
				continue;
			}

			try {
				const result = await aiService.generateWithProvider(
					provider,
					model,
					prompt,
				);
				if (result) return result;
			} catch (error) {
				console.warn(`Provider ${provider}/${model} failed:`, error);
				continue;
			}
		}

		throw new Error('All AI providers failed. Please check your API keys.');
	},

	// Generate text with a specific provider
	generateWithProvider: async (
		providerName: AIProvider,
		modelName: string,
		prompt: string,
	): Promise<string> => {
		const providerConfig = providers.find((p) => p.name === providerName);
		if (!providerConfig) {
			throw new Error(`Unknown provider: ${providerName}`);
		}

		const client = providerConfig.createClient();
		const model = client(modelName);

		const { text } = await generateText({
			model,
			prompt,
		});

		return text;
	},

	// Get models for a provider
	getModelsForProvider: (provider: AIProvider): string[] => {
		const config = providers.find((p) => p.name === provider);
		return config?.models || [];
	},
};
