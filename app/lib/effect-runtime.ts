import { Layer, Logger, LogLevel, ManagedRuntime } from 'effect';
import { AIServiceLive } from '../services/ai.service.js';
import { CommentServiceLive } from '../services/comment.service.js';
import { DbServiceLive } from '../services/db.service.js';
import { GitServiceLive } from '../services/git.service.js';
import { RepoServiceLive } from '../services/repo.service.js';
import { TmuxServiceLive } from '../services/tmux.service.js';
import { ConfigServiceLive } from './config.js';

// Logging layer - JSON for production, pretty for development
const LoggingLive = Layer.mergeAll(
	process.env.NODE_ENV === 'production' ? Logger.json : Logger.pretty,
	Logger.minimumLogLevel(
		process.env.NODE_ENV === 'production' ? LogLevel.Info : LogLevel.Debug,
	),
);

// Compose all service layers
export const AppLayer = Layer.mergeAll(
	ConfigServiceLive,
	DbServiceLive,
	GitServiceLive,
	TmuxServiceLive,
	RepoServiceLive,
	CommentServiceLive,
	AIServiceLive,
).pipe(Layer.provide(LoggingLive));

// Runtime instance - initialized with all services
export const runtime = ManagedRuntime.make(AppLayer);

// Generate unique IDs
export const generateId = (): string => {
	return crypto.randomUUID();
};
