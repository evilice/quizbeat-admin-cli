import { useEffect, useState } from 'react';

/** Пауза после ввода в строке поиска перед запросом списка. */
export const SEARCH_DEBOUNCE_MS = 300;

export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
};
