import type {
  AudioClipDifficulty,
  AudioClipStatus,
} from '../stores/compositions-store.ts';

export const CLIP_STATUS_LABELS: Record<AudioClipStatus, string> = {
  PENDING: 'В очереди',
  PROCESSING: 'Нарезается',
  DONE: 'Готово',
  FAILED: 'Не удалось нарезать',
};

export const DIFFICULTY_LABELS: Record<AudioClipDifficulty, string> = {
  EASY: 'Лёгкая',
  MEDIUM: 'Средняя',
  HARD: 'Сложная',
};

export function isPointInsideTrack(
  startTimeSec: number,
  durationSec: number,
  originalAudioDurationSec: number,
): boolean {
  return (
    Number.isInteger(startTimeSec) &&
    startTimeSec >= 0 &&
    startTimeSec + durationSec <= originalAudioDurationSec
  );
}

export function hasUnfinishedClip(
  clips: readonly { status: AudioClipStatus }[],
): boolean {
  return clips.some(
    (clip) => clip.status === 'PENDING' || clip.status === 'PROCESSING',
  );
}
