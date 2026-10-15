import { useCallback, useMemo, useState } from 'react';
import useLocalStorageValue from './useLocalStorageValue';

function parse(raw, fallback) {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

// useState that survives reloads via localStorage (safe when storage is blocked)
export default function usePersistedState(key, initialValue) {
  const [raw, setRaw] = useLocalStorageValue(key);
  const [initial] = useState(initialValue);
  const value = useMemo(() => parse(raw, initial), [raw, initial]);

  const setValue = useCallback((next) => {
    setRaw((currentRaw) => JSON.stringify(typeof next === 'function' ? next(parse(currentRaw, initial)) : next));
  }, [setRaw, initial]);

  return [value, setValue];
}
