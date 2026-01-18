import { Data } from 'effect';

// Database errors
export class DatabaseError extends Data.TaggedError('DatabaseError')<{
	message: string;
	cause?: unknown;
}> {}

// Git errors
export class GitError extends Data.TaggedError('GitError')<{
	message: string;
	cause?: unknown;
}> {}

export class NotAGitRepoError extends Data.TaggedError('NotAGitRepoError')<{
	path: string;
}> {}

// Transport errors (replaces tmux errors)
export class TransportError extends Data.TaggedError('TransportError')<{
	message: string;
	cause?: unknown;
}> {}

export class TargetNotFoundError extends Data.TaggedError(
	'TargetNotFoundError',
)<{
	targetId: string;
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

// Comment errors
export class CommentNotFoundError extends Data.TaggedError(
	'CommentNotFoundError',
)<{
	id: string;
}> {}

export class CommentValidationError extends Data.TaggedError(
	'CommentValidationError',
)<{
	field: string;
	message: string;
}> {}

// Repo errors
export class RepoNotFoundError extends Data.TaggedError('RepoNotFoundError')<{
	id: string;
}> {}

export class SessionNotFoundError extends Data.TaggedError(
	'SessionNotFoundError',
)<{
	id: string;
}> {}
