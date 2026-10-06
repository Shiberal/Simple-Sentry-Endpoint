import { useCallback, useSyncExternalStore } from 'react';

// Live match state of a CSS media query; `false` on the server and during hydration.
export default function useMediaQuery(query) {
  const subscribe = useCallback((callback) => {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener('change', callback);
    return () => mediaQuery.removeEventListener('change', callback);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
