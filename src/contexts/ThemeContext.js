import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import useLocalStorageValue from '@/hooks/useLocalStorageValue';

const ThemeContext = createContext();

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeSystemTheme(callback) {
  const mediaQuery = window.matchMedia(DARK_QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

const systemIsDark = () => window.matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children }) {
  const [storedTheme, setStoredTheme] = useLocalStorageValue('theme');
  const theme = storedTheme || 'system';
  const prefersDark = useSyncExternalStore(subscribeSystemTheme, systemIsDark, () => false);
  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setAndSaveTheme = (newTheme) => setStoredTheme(newTheme);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: setAndSaveTheme }}>
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

