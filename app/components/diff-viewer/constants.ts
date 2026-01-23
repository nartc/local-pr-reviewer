// Default number of files to expand initially
export const DEFAULT_EXPANDED_COUNT = 10;

// Default threshold for auto-collapsing large files (total lines changed)
export const DEFAULT_LARGE_FILE_THRESHOLD = 500;

// Patterns for files that should be auto-collapsed (lock files, generated files, etc.)
export const AUTO_COLLAPSE_PATTERNS = [
	// JavaScript/Node
	/package-lock\.json$/,
	/yarn\.lock$/,
	/pnpm-lock\.yaml$/,
	/npm-shrinkwrap\.json$/,
	// Ruby
	/Gemfile\.lock$/,
	// Rust
	/Cargo\.lock$/,
	// PHP
	/composer\.lock$/,
	// Python
	/Pipfile\.lock$/,
	/poetry\.lock$/,
	/pdm\.lock$/,
	/uv\.lock$/,
	// .NET
	/packages\.lock\.json$/,
	// Go
	/go\.sum$/,
	// Elixir
	/mix\.lock$/,
	// Swift/iOS
	/Podfile\.lock$/,
	/Package\.resolved$/,
	// Generic lock files
	/\.lock$/,
	/\.lockb$/,
];
