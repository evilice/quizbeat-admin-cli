/**
 * Та же нормализация, что на сервере (`trim` + нижний регистр).
 * Пустая строка после trim — не email.
 */
export function normalizeEmail(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}
