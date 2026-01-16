import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
type Density = 'normal' | 'compact';

interface ThemeContextValue {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
	density: Density;
	setDensity: (density: Density) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'pr-reviewer-theme';
const DENSITY_KEY = 'pr-reviewer-density';

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
	const [density, setDensityState] = useState<Density>('normal');

	// Initialize theme and density from localStorage
	useEffect(() => {
		const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
		if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
			setThemeState(storedTheme);
			setResolvedTheme(resolveTheme(storedTheme));
		} else {
			setResolvedTheme(getSystemTheme());
		}

		const storedDensity = localStorage.getItem(
			DENSITY_KEY,
		) as Density | null;
		if (storedDensity && ['normal', 'compact'].includes(storedDensity)) {
			setDensityState(storedDensity);
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

	// Apply theme to document (for non-Radix elements)
	useEffect(() => {
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(resolvedTheme);
	}, [resolvedTheme]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		setResolvedTheme(resolveTheme(newTheme));
		localStorage.setItem(THEME_KEY, newTheme);
	};

	const setDensity = (newDensity: Density) => {
		setDensityState(newDensity);
		localStorage.setItem(DENSITY_KEY, newDensity);
	};

	// Memoize context value to prevent unnecessary re-renders
	const value = useMemo(
		() => ({ theme, resolvedTheme, setTheme, density, setDensity }),
		[theme, resolvedTheme, density],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
}

// Helper to map density to Radix scaling
export function densityToScaling(density: Density): '90%' | '100%' {
	return density === 'compact' ? '90%' : '100%';
}
