import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'pr-reviewer-theme';

function getSystemTheme(): ResolvedTheme {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
	if (theme === 'system') return getSystemTheme();
	return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<Theme>('system');
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

	// Initialize theme from localStorage
	useEffect(() => {
		const stored = localStorage.getItem(THEME_KEY) as Theme | null;
		if (stored && ['light', 'dark', 'system'].includes(stored)) {
			setThemeState(stored);
			setResolvedTheme(resolveTheme(stored));
		} else {
			setResolvedTheme(getSystemTheme());
		}
	}, []);

	// Listen for system theme changes
	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => {
			if (theme === 'system') {
				setResolvedTheme(getSystemTheme());
			}
		};
		mediaQuery.addEventListener('change', handler);
		return () => mediaQuery.removeEventListener('change', handler);
	}, [theme]);

	// Apply theme to document
	useEffect(() => {
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(resolvedTheme);
	}, [resolvedTheme]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		setResolvedTheme(resolveTheme(newTheme));
		localStorage.setItem(THEME_KEY, newTheme);
	};

	return (
		<ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
}
