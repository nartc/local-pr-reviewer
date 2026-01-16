import { Effect, Layer, ManagedRuntime } from 'effect';

// Create a managed runtime for the application
// Services will be added to this layer as they are created
export const AppLayer = Layer.empty;

// Runtime instance - will be initialized with services
export const runtime = ManagedRuntime.make(AppLayer);

// Helper to run effects in loaders/actions
export const runEffect = <A, E>(
	effect: Effect.Effect<A, E, never>,
): Promise<A> => {
	return Effect.runPromise(effect);
};

// Helper to run effects that may fail, returning Result type
export const runEffectEither = <A, E>(
	effect: Effect.Effect<A, E, never>,
): Promise<{ success: true; data: A } | { success: false; error: E }> => {
	return Effect.runPromise(
		effect.pipe(
			Effect.map((data) => ({ success: true as const, data })),
			Effect.catchAll((error) =>
				Effect.succeed({ success: false as const, error }),
			),
		),
	);
};

// Generate unique IDs
export const generateId = (): string => {
	return crypto.randomUUID();
};
