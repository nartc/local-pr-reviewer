import { Layer, Logger, LogLevel, ManagedRuntime } from 'effect';
import { AIServiceLive } from '../services/ai.service';
import { CommentServiceLive } from '../services/comment.service';
import { DbServiceLive } from '../services/db.service';
import { GitServiceLive } from '../services/git.service';
import { RepoServiceLive } from '../services/repo.service';
import { TransportServiceLive } from '../services/transport.service';
import { ConfigServiceLive } from './config';

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
	TransportServiceLive,
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
