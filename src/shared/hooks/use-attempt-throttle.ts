import { useCallback, useRef } from 'react';

/**
 * Пускает не больше одной попытки на ключ за `intervalMs`.
 * Нужен для обновления протухших presigned-ссылок: раз в час — можно,
 * бесконечный цикл на битом файле — нет.
 */
export const useAttemptThrottle = (
  intervalMs: number,
): ((key: string) => boolean) => {
  const lastAttempts = useRef(new Map<string, number>());

  return useCallback(
    (key: string) => {
      const now = Date.now();
      const last = lastAttempts.current.get(key);
      if (last !== undefined && now - last < intervalMs) {
        return false;
      }
      lastAttempts.current.set(key, now);
      return true;
    },
    [intervalMs],
  );
};
