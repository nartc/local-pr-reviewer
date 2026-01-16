import { Button, Callout, IconButton, Text, Tooltip } from '@radix-ui/themes';
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
	error: { icon: VscError, color: 'red' as const },
	warning: { icon: VscWarning, color: 'amber' as const },
	info: { icon: VscInfo, color: 'blue' as const },
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
		<Callout.Root color={config.color} role="alert">
			<Callout.Icon>
				<Icon />
			</Callout.Icon>
			<Callout.Text>
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<Text weight="medium">{title}</Text>
						{message && (
							<Text size="2" color="gray" className="mt-1 block">
								{message}
							</Text>
						)}
						{details && (
							<pre className="mt-2 text-xs text-gray-500 bg-white/50 dark:bg-black/20 rounded p-2 overflow-x-auto">
								{details}
							</pre>
						)}
						{onRetry && (
							<Button
								variant="ghost"
								size="1"
								onClick={onRetry}
								className="mt-2"
							>
								<VscRefresh aria-hidden="true" />
								Try again
							</Button>
						)}
					</div>
					{onDismiss && (
						<Tooltip content="Dismiss">
							<IconButton
								variant="ghost"
								size="1"
								onClick={onDismiss}
								aria-label="Dismiss"
							>
								<VscClose aria-hidden="true" />
							</IconButton>
						</Tooltip>
					)}
				</div>
			</Callout.Text>
		</Callout.Root>
	);
}

// Inline error for form fields
export function InlineError({ message }: { message: string }) {
	return (
		<Text
			size="1"
			color="red"
			className="mt-1 flex items-center gap-1"
			role="alert"
		>
			<VscError aria-hidden="true" />
			{message}
		</Text>
	);
}

// Toast-style error notification
interface ErrorToastProps {
	message: string;
	onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
	return (
		<div
			role="alert"
			className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4"
		>
			<Callout.Root color="red" size="1">
				<Callout.Icon>
					<VscError />
				</Callout.Icon>
				<Callout.Text className="flex items-center gap-2">
					<Text size="2">{message}</Text>
					<Tooltip content="Dismiss">
						<IconButton
							variant="ghost"
							size="1"
							onClick={onDismiss}
							aria-label="Dismiss"
						>
							<VscClose aria-hidden="true" />
						</IconButton>
					</Tooltip>
				</Callout.Text>
			</Callout.Root>
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
