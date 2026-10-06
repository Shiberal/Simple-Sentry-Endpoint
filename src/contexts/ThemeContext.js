import { createContext, useContext, useEffect } from 'react';
import useLocalStorageValue from '@/hooks/useLocalStorageValue';
import useMediaQuery from '@/hooks/useMediaQuery';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [storedTheme, setStoredTheme] = useLocalStorageValue('theme');
  const theme = storedTheme || 'system';
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
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

