import { useEffect, useState } from 'react';
import { ago, until } from './helpers';

/** Owns its own 30s tick so the parent page does not re-render for relative times. */
export default function RelativeTime({ date, mode = 'ago', empty = 'never' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!date && mode === 'ago') return empty;
  if (!date) return '-';
  return mode === 'until' ? until(date, now) : ago(date, now);
}
