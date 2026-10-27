const BYTE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ'] as const;
const BYTE_STEP = 1024;

export const STORAGE_DENIED_MESSAGE = 'Раздел доступен только супер-админу.';

export const STORAGE_NOTHING_TO_DELETE_MESSAGE = 'Удалять нечего.';

export const STORAGE_PENDING_MESSAGE = 'Запрос выполняется.';

export const STORAGE_PREVIEW_STALE_MESSAGE =
  'Предпросмотр устарел. Проверьте хранилище заново.';

export const STORAGE_OUTCOME_UNKNOWN_MESSAGE =
  'Исход удаления неизвестен: часть файлов могла быть удалена. Проверьте хранилище заново.';

const PREFIX_LABELS: Record<string, string> = {
  images: 'Картинки',
  audio: 'Аудио',
  video: 'Видео',
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 1) {
    return '0 Б';
  }

  let value = bytes;
  let unitIndex = 0;
  while (value >= BYTE_STEP && unitIndex < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${String(Math.round(value))} ${BYTE_UNITS[0]}`;
  }

  let rounded = Math.round(value * 10) / 10;
  if (rounded >= BYTE_STEP && unitIndex < BYTE_UNITS.length - 1) {
    rounded = Math.round((rounded / BYTE_STEP) * 10) / 10;
    unitIndex += 1;
  }

  return `${formatScaled(rounded)} ${BYTE_UNITS[unitIndex]}`;
};

export const filesWord = (count: number): string => {
  const abs = Math.abs(Math.trunc(count));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'файл';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'файла';
  }
  return 'файлов';
};

export const prefixLabel = (prefix: string): string => {
  return Object.hasOwn(PREFIX_LABELS, prefix)
    ? (PREFIX_LABELS[prefix] ?? prefix)
    : prefix;
};

export const filesSummary = (count: number, bytes: number): string => {
  return `${count} ${filesWord(count)} (${formatBytes(bytes)})`;
};

export const deleteSweepLabel = (count: number, bytes: number): string => {
  return `Удалить ${filesSummary(count, bytes)}`;
};

export const failedSweepMessage = (bytes: number): string => {
  return `Часть файлов не удалена (${formatBytes(bytes)}). Проверьте хранилище заново.`;
};

const formatScaled = (rounded: number): string => {
  return rounded.toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  });
};
