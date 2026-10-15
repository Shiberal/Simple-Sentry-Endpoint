import { useEffect, useRef } from 'react';

// Runs `fn` once after the first render. Unlike a bare useEffect(..., []) it always calls
// the first-render closure, which is what one-off page-load fetches want.
export default function useMountEffect(fn) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current();
  }, []);
}
