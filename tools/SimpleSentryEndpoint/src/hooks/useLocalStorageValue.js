import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set();

function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

// Raw localStorage string (null on the server, first hydration pass, or when unset/blocked).
// Writes notify every subscriber in this tab; other tabs arrive via the "storage" event.
export default function useLocalStorageValue(key) {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  // `next` is a string or an updater (currentRaw) => string.
  const setRaw = useCallback((next) => {
    try {
      window.localStorage.setItem(key, typeof next === 'function' ? next(read(key)) : next);
    } catch (e) {
      // ignore quota/blocked storage
    }
    listeners.forEach((cb) => cb());
  }, [key]);
  return [raw, setRaw];
}
