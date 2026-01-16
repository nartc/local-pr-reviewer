import {
	VscClose,
	VscError,
	VscInfo,
	VscRefresh,
	VscWarning,
} from 'react-icons/vsc';

type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorDisplayProps {
	severity?: ErrorSeverity;
	title: string;
	message?: string;
	details?: string;
	onDismiss?: () => void;
	onRetry?: () => void;
}

const severityConfig = {
	error: {
		icon: VscError,
		bgClass: 'bg-red-50 dark:bg-red-900/20',
		borderClass: 'border-red-200 dark:border-red-800',
		iconClass: 'text-red-500',
		titleClass: 'text-red-800 dark:text-red-200',
	},
	warning: {
		icon: VscWarning,
		bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
		borderClass: 'border-yellow-200 dark:border-yellow-800',
		iconClass: 'text-yellow-500',
		titleClass: 'text-yellow-800 dark:text-yellow-200',
	},
	info: {
		icon: VscInfo,
		bgClass: 'bg-blue-50 dark:bg-blue-900/20',
		borderClass: 'border-blue-200 dark:border-blue-800',
		iconClass: 'text-blue-500',
		titleClass: 'text-blue-800 dark:text-blue-200',
	},
};

export function ErrorDisplay({
	severity = 'error',
	title,
	message,
	details,
	onDismiss,
	onRetry,
}: ErrorDisplayProps) {
	const config = severityConfig[severity];
	const Icon = config.icon;

	return (
		<div
			className={`rounded-lg border p-4 ${config.bgClass} ${config.borderClass}`}
		>
			<div className="flex items-start gap-3">
				<Icon
					className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconClass}`}
				/>
				<div className="flex-1 min-w-0">
					<h3 className={`font-medium ${config.titleClass}`}>
						{title}
					</h3>
					{message && (
						<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
							{message}
						</p>
					)}
					{details && (
						<pre className="mt-2 text-xs text-gray-500 bg-white/50 dark:bg-black/20 rounded p-2 overflow-x-auto">
							{details}
						</pre>
					)}
					{onRetry && (
						<button
							onClick={onRetry}
							className="mt-3 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
						>
							<VscRefresh className="w-4 h-4" />
							Try again
						</button>
					)}
				</div>
				{onDismiss && (
					<button
						onClick={onDismiss}
						className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					>
						<VscClose className="w-4 h-4" />
					</button>
				)}
			</div>
		</div>
	);
}

// Inline error for form fields
export function InlineError({ message }: { message: string }) {
	return (
		<p className="mt-1 text-sm text-red-500 flex items-center gap-1">
			<VscError className="w-4 h-4" />
			{message}
		</p>
	);
}

// Toast-style error notification
interface ErrorToastProps {
	message: string;
	onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
	return (
		<div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
			<div className="flex items-center gap-3 px-4 py-3 bg-red-500 text-white rounded-lg shadow-lg">
				<VscError className="w-5 h-5 shrink-0" />
				<span className="text-sm">{message}</span>
				<button
					onClick={onDismiss}
					className="p-1 hover:bg-red-600 rounded"
				>
					<VscClose className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}

// Git-specific errors
export function GitError({
	error,
	onRetry,
}: {
	error: string;
	onRetry?: () => void;
}) {
	return (
		<ErrorDisplay
			severity="error"
			title="Git Error"
			message="Failed to access the repository."
			details={error}
			onRetry={onRetry}
		/>
	);
}

// tmux-specific errors
export function TmuxError({
	error,
	onRetry,
}: {
	error: string;
	onRetry?: () => void;
}) {
	return (
		<ErrorDisplay
			severity="error"
			title="tmux Error"
			message="Failed to communicate with tmux."
			details={error}
			onRetry={onRetry}
		/>
	);
}

// AI-specific errors
export function AIError({
	error,
	onRetry,
}: {
	error: string;
	onRetry?: () => void;
}) {
	return (
		<ErrorDisplay
			severity="error"
			title="AI Processing Error"
			message="Failed to process comments with AI."
			details={error}
			onRetry={onRetry}
		/>
	);
}
