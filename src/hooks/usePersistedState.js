import { useEffect, useState } from 'react';

// useState that survives reloads via localStorage (safe when storage is blocked)
export default function usePersistedState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored));
    } catch (e) {
      // ignore unreadable/blocked storage
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore quota/blocked storage
    }
  }, [key, value, hydrated]);

  return [value, setValue];
}
