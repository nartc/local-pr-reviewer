import { Data } from 'effect';

// Database errors
export class DatabaseError extends Data.TaggedError('DatabaseError')<{
	message: string;
	cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError('NotFoundError')<{
	entity: string;
	id: string;
}> {}

// Git errors
export class GitError extends Data.TaggedError('GitError')<{
	message: string;
	cause?: unknown;
}> {}

export class NotAGitRepoError extends Data.TaggedError('NotAGitRepoError')<{
	path: string;
}> {}

// tmux errors
export class TmuxError extends Data.TaggedError('TmuxError')<{
	message: string;
	cause?: unknown;
}> {}

export class TmuxSessionNotFoundError extends Data.TaggedError(
	'TmuxSessionNotFoundError',
)<{
	session: string;
}> {}

// AI errors
export class AIError extends Data.TaggedError('AIError')<{
	message: string;
	provider?: string;
	cause?: unknown;
}> {}

export class AIProviderUnavailableError extends Data.TaggedError(
	'AIProviderUnavailableError',
)<{
	provider: string;
}> {}

// Send errors
export class SendError extends Data.TaggedError('SendError')<{
	message: string;
	cause?: unknown;
}> {}

// Validation errors
export class ValidationError extends Data.TaggedError('ValidationError')<{
	field: string;
	message: string;
}> {}
