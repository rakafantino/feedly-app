'use client';

import { useEffect, useState } from 'react';

/**
 * Debounce a frequently-changing value. The returned value updates only after
 * `delayMs` has elapsed without `value` changing. The timer resets on every
 * change to `value` or `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
