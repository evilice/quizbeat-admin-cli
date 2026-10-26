/**
 * Зеркало серверной `VIDEO_MAX_CLIP_DURATION_SEC`
 * (`quizbeat-srv`, `src/config/env.schema.ts`, дефолт 60).
 * Источник истины — сервер; клиент только не даёт отправить заведомо
 * длинный отрезок.
 */
export const MAX_VIDEO_CLIP_SEC = 60;

/**
 * Зеркало серверной `MIN_CLIP_DURATION_SEC`
 * (`quizbeat-srv`, `src/composition-video/constants.ts`).
 */
export const MIN_VIDEO_CLIP_SEC = 0.1;

export const VIDEO_UNREADABLE_MESSAGE =
  'Не удалось прочитать видео; нужен mp4 или webm';

const NOT_NUMBERS_MESSAGE = 'Начало и конец — числа';
const START_NEGATIVE_MESSAGE = 'Начало не меньше 0';
const END_NOT_AFTER_START_MESSAGE = 'Конец должен быть позже начала';
const CLIP_TOO_SHORT_MESSAGE = 'Длина отрезка не меньше 0,1 с';
const CLIP_TOO_LONG_MESSAGE = 'Длина отрезка не больше 60 с';
const END_BEYOND_DURATION_MESSAGE = 'Конец не позже длительности видео';

export type VideoBounds = {
  start: number;
  end: number;
};

export type VideoSaveBounds = {
  startSec: number;
  endSec: number;
};

/** Как сервер: границы сравниваются в целых миллисекундах, не сырым float. */
const toMs = (sec: number): number => Math.round(sec * 1000);

export const defaultBounds = (durationSec: number): VideoBounds => {
  return {
    start: 0,
    end: Math.min(durationSec, MAX_VIDEO_CLIP_SEC),
  };
};

/** До сотых, как в задаче: `Math.round(v * 100) / 100`. */
export const roundSec = (value: number): number => {
  return Math.round(value * 100) / 100;
};

/**
 * Вниз до сотых. `1e-8` не даёт `Math.floor(0.29 * 100)` стать 28
 * из-за `0.29 * 100 === 28.999…`.
 */
export const roundDownSec = (value: number): number => {
  return Math.floor(value * 100 + 1e-8) / 100;
};

/**
 * Пустая и пробельная строка — `NaN`, не `0`: `Number('')` дал бы обрезку
 * с нуля, сервер такую строку отклоняет.
 */
export const parseBound = (value: string): number => {
  if (value.trim() === '') {
    return Number.NaN;
  }
  return Number(value);
};

export const validateBounds = (
  start: number,
  end: number,
  durationSec: number,
): string | null => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return NOT_NUMBERS_MESSAGE;
  }
  if (start < 0) {
    return START_NEGATIVE_MESSAGE;
  }
  if (end <= start) {
    return END_NOT_AFTER_START_MESSAGE;
  }
  const lengthMs = toMs(end) - toMs(start);
  if (lengthMs < toMs(MIN_VIDEO_CLIP_SEC)) {
    return CLIP_TOO_SHORT_MESSAGE;
  }
  if (lengthMs > toMs(MAX_VIDEO_CLIP_SEC)) {
    return CLIP_TOO_LONG_MESSAGE;
  }
  if (toMs(end) > toMs(durationSec)) {
    return END_BEYOND_DURATION_MESSAGE;
  }
  return null;
};

/**
 * В запрос уходят сотые. Округление вверх иногда выносит конец за
 * длительность: `4.996` → `5`, и сервер это отклонит (`toMs(5) > toMs(4.996)`).
 * Тогда конец зажимается вниз. Если миллисекунды совпадают
 * (`9.9996` → `10`), округление остаётся — сервер его принимает.
 * Конец, который и до округления длиннее ролика, не зажимается:
 * введённая `5` при ролике `4.996` остаётся `5` и не проходит проверку.
 */
export const boundsForSave = (
  start: number,
  end: number,
  durationSec: number,
): VideoSaveBounds => {
  return {
    startSec: roundWithinDuration(start, durationSec),
    endSec: roundWithinDuration(end, durationSec),
  };
};

/**
 * Причина для кнопки «Сохранить» — по тем же числам, что уйдут в запрос.
 * Сырые 4.896 и 4.996 при ролике 4.996 в миллисекундах дают 0,1 с,
 * после сотых — меньше минимума.
 */
export const clipBounds = (
  start: number,
  end: number,
  durationSec: number,
): VideoSaveBounds & { reason: string | null } => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return {
      reason: validateBounds(start, end, durationSec),
      startSec: start,
      endSec: end,
    };
  }
  const saved = boundsForSave(start, end, durationSec);
  return {
    reason: validateBounds(saved.startSec, saved.endSec, durationSec),
    startSec: saved.startSec,
    endSec: saved.endSec,
  };
};

export const roundWithinDuration = (
  value: number,
  durationSec: number,
): number => {
  const rounded = roundSec(value);
  if (value <= durationSec && toMs(rounded) > toMs(durationSec)) {
    return roundDownSec(durationSec);
  }
  return rounded;
};
