import { useEffect, useRef, useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import {
  VIDEO_UNREADABLE_MESSAGE,
  boundsForSave,
  clipBounds,
  defaultBounds,
  parseBound,
  roundWithinDuration,
  type VideoSaveBounds,
} from './video-trim.ts';

export const useVideoTrim = ({
  compositionId,
  active,
  onSaved,
}: {
  compositionId: string;
  active: boolean;
  onSaved: (compositionId: string, videoDurationSec: number) => void;
}) => {
  const { video } = useRootStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const clipPlaybackRef = useRef(false);
  const playGenerationRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [start, setStartValue] = useState('');
  const [end, setEndValue] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<readonly string[]>([]);

  // Предпросмотр и отправка работают с одними и теми же числами:
  // сотые, зажатые в длительность (`clipBounds`), а не сырой ввод.
  const clip =
    durationSec === null
      ? null
      : clipBounds(parseBound(start), parseBound(end), durationSec);
  const playableClip =
    clip !== null &&
    Number.isFinite(clip.startSec) &&
    Number.isFinite(clip.endSec) &&
    clip.endSec > clip.startSec
      ? clip
      : null;

  const revokeCurrent = () => {
    const url = objectUrlRef.current;
    if (url === null) {
      return;
    }
    URL.revokeObjectURL(url);
    objectUrlRef.current = null;
  };

  // Паузит только проигрыш отрезка: обычный просмотр правка границ не рвёт.
  const stopClip = () => {
    playGenerationRef.current += 1;
    const wasClipPlayback = clipPlaybackRef.current;
    clipPlaybackRef.current = false;
    if (wasClipPlayback) {
      videoRef.current?.pause();
    }
  };

  // Правка границ: останавливает отрезок и снимает ошибку прошлой отправки.
  const editBounds = (apply: () => void) => {
    stopClip();
    setMessages([]);
    apply();
  };

  // Длительность известна только после `loadedmetadata`: до него и при
  // сбое чтения границ нет.
  const resetBounds = () => {
    setDurationSec(null);
    setStartValue('');
    setEndValue('');
  };

  const clearPreview = () => {
    stopClip();
    revokeCurrent();
    setFile(null);
    setObjectUrl(null);
    resetBounds();
    setPlaybackError(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clipPlaybackRef.current = false;
      const url = objectUrlRef.current;
      if (url !== null) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!active) {
      stopClip();
      videoRef.current?.pause();
    }
  }, [active]);

  const selectFile = (next: File) => {
    if (busyRef.current) {
      return;
    }
    stopClip();
    const url = URL.createObjectURL(next);
    const previous = objectUrlRef.current;
    objectUrlRef.current = url;
    if (previous !== null) {
      URL.revokeObjectURL(previous);
    }
    setFile(next);
    setObjectUrl(url);
    resetBounds();
    setPlaybackError(null);
    setMessages([]);
  };

  const sourceIsCurrent = (element: HTMLVideoElement): boolean => {
    const current = objectUrlRef.current;
    return current !== null && element.getAttribute('src') === current;
  };

  const onLoadedMetadata = () => {
    const element = videoRef.current;
    if (element === null || !sourceIsCurrent(element)) {
      return;
    }
    const duration = element.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      resetBounds();
      setPlaybackError(VIDEO_UNREADABLE_MESSAGE);
      return;
    }
    const bounds = defaultBounds(duration);
    setDurationSec(duration);
    setStartValue(String(bounds.start));
    setEndValue(String(bounds.end));
    setPlaybackError(null);
  };

  const onVideoError = () => {
    const element = videoRef.current;
    if (!mountedRef.current || element === null || !sourceIsCurrent(element)) {
      return;
    }
    clipPlaybackRef.current = false;
    setPlaybackError(VIDEO_UNREADABLE_MESSAGE);
  };

  const setStart = (value: string) => {
    editBounds(() => {
      setStartValue(value);
    });
  };

  const setEnd = (value: string) => {
    editBounds(() => {
      setEndValue(value);
    });
  };

  const setSlider = (value: number | readonly number[]) => {
    if (!Array.isArray(value) || durationSec === null) {
      return;
    }
    const nextStart = value[0];
    const nextEnd = value[1];
    if (nextStart === undefined || nextEnd === undefined) {
      return;
    }
    const saved = boundsForSave(nextStart, nextEnd, durationSec);
    editBounds(() => {
      setStartValue(String(saved.startSec));
      setEndValue(String(saved.endSec));
    });
  };

  const setBoundToCurrent = (setBound: (value: string) => void) => {
    const element = videoRef.current;
    if (element === null || durationSec === null || playbackError !== null) {
      return;
    }
    const current = roundWithinDuration(element.currentTime, durationSec);
    editBounds(() => {
      setBound(String(current));
    });
  };

  const setStartToCurrent = () => {
    setBoundToCurrent(setStartValue);
  };

  const setEndToCurrent = () => {
    setBoundToCurrent(setEndValue);
  };

  const playClip = () => {
    const element = videoRef.current;
    if (
      element === null ||
      playableClip === null ||
      playbackError !== null ||
      busyRef.current
    ) {
      return;
    }
    playGenerationRef.current += 1;
    const generation = playGenerationRef.current;
    clipPlaybackRef.current = true;
    element.currentTime = playableClip.startSec;
    const played = element.play();
    if (played !== undefined) {
      void played.catch(() => {
        if (playGenerationRef.current === generation) {
          clipPlaybackRef.current = false;
        }
      });
    }
  };

  // Нативная пауза и конец ролика завершают проигрывание отрезка: иначе
  // флаг переживёт его и обрежет следующий обычный просмотр. Событие
  // `pause` приходит асинхронно: если `playClip` успел вызвать `play()`,
  // это устаревшая пауза, и новый отрезок она не трогает.
  const onPause = () => {
    if (videoRef.current?.paused === false) {
      return;
    }
    clipPlaybackRef.current = false;
  };

  const onEnded = () => {
    clipPlaybackRef.current = false;
  };

  const onTimeUpdate = () => {
    if (!clipPlaybackRef.current) {
      return;
    }
    const element = videoRef.current;
    if (element === null || playableClip === null) {
      return;
    }
    if (element.currentTime >= playableClip.endSec) {
      clipPlaybackRef.current = false;
      element.pause();
      element.currentTime = playableClip.startSec;
    }
  };

  const submit = async () => {
    if (
      busyRef.current ||
      file === null ||
      clip === null ||
      clip.reason !== null ||
      playbackError !== null
    ) {
      return;
    }
    const fileToSend = file;
    busyRef.current = true;
    setBusy(true);
    setMessages([]);
    try {
      const result = await video.save(
        compositionId,
        fileToSend,
        clip.startSec,
        clip.endSec,
      );
      // Карточка должна узнать об успешной загрузке, даже если редактор уже
      // размонтирован; id защищает от применения к другой композиции.
      onSaved(compositionId, result.videoDurationSec);
      if (!mountedRef.current) {
        return;
      }
      clearPreview();
    } catch (error) {
      if (mountedRef.current) {
        setMessages(messagesFromError(error));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };

  const boundsReason = clip?.reason ?? null;
  const blockReason = playbackError ?? boundsReason;
  const boundsLocked = busy || playbackError !== null;
  const saveDisabled =
    busy ||
    file === null ||
    durationSec === null ||
    playbackError !== null ||
    boundsReason !== null;
  const playDisabled =
    busy ||
    durationSec === null ||
    playbackError !== null ||
    playableClip === null;

  const sliderValue: [number, number] | null =
    durationSec === null ? null : orderedSlider(clip, durationSec);

  return {
    videoRef,
    file,
    objectUrl,
    durationSec,
    start,
    end,
    busy,
    messages,
    blockReason,
    saveDisabled,
    playDisabled,
    boundsLocked,
    sliderValue,
    selectFile,
    setStart,
    setEnd,
    setSlider,
    setStartToCurrent,
    setEndToCurrent,
    playClip,
    onLoadedMetadata,
    onTimeUpdate,
    onPause,
    onEnded,
    onVideoError,
    submit,
  };
};

/** Ползунок рисует те же сотые, что уйдут в запрос; пустое поле — край ролика. */
const orderedSlider = (
  clip: VideoSaveBounds | null,
  durationSec: number,
): [number, number] => {
  const low =
    clip !== null && Number.isFinite(clip.startSec)
      ? Math.min(Math.max(clip.startSec, 0), durationSec)
      : 0;
  const high =
    clip !== null && Number.isFinite(clip.endSec)
      ? Math.min(Math.max(clip.endSec, 0), durationSec)
      : durationSec;
  return [Math.min(low, high), Math.max(low, high)];
};
