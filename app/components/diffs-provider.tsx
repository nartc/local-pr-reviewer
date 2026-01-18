import type {
	WorkerInitializationRenderOptions,
	WorkerPoolOptions,
} from '@pierre/diffs/react';
import { useEffect, useState, type ReactNode } from 'react';

interface DiffsProviderProps {
	children: ReactNode;
}

interface ProviderState {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	WorkerPoolContextProvider: React.ComponentType<any>;
	poolOptions: WorkerPoolOptions;
	highlighterOptions: WorkerInitializationRenderOptions;
}

/**
 * Client-side provider for @pierre/diffs worker pool.
 * Should be placed at the app root level to ensure workers persist across navigation.
 * Uses singleton pattern internally, so mounting multiple times is safe.
 */
export function DiffsProvider({ children }: DiffsProviderProps) {
	const [provider, setProvider] = useState<ProviderState | null>(null);

	useEffect(() => {
		// Only load on client
		if (typeof window === 'undefined') return;

		Promise.all([
			import('@pierre/diffs/react'),
			import('../lib/worker-pool'),
		]).then(([diffsReact, workerPool]) => {
			setProvider({
				WorkerPoolContextProvider: diffsReact.WorkerPoolContextProvider,
				poolOptions: workerPool.poolOptions,
				highlighterOptions: workerPool.highlighterOptions,
			});
		});
	}, []);

	// Render children immediately - FileDiff will show loading state until provider is ready
	if (!provider) {
		return <>{children}</>;
	}

	const { WorkerPoolContextProvider, poolOptions, highlighterOptions } =
		provider;

	return (
		<WorkerPoolContextProvider
			poolOptions={poolOptions}
			highlighterOptions={highlighterOptions}
		>
			{children}
		</WorkerPoolContextProvider>
	);
}
