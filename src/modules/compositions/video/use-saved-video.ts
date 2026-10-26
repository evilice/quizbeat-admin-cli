import { useEffect, useRef, useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useAttemptThrottle } from '../../../shared/hooks/use-attempt-throttle.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';

const URL_REFRESH_INTERVAL_MS = 60_000;

export const useSavedVideo = ({
  compositionId,
  videoUrl,
  videoDurationSec,
  videoVersion,
  active,
  onVideoSaved,
  onVideoRemoved,
  onVideoUrl,
}: {
  compositionId: string;
  videoUrl: string | null;
  videoDurationSec: number | null;
  videoVersion: number;
  active: boolean;
  onVideoSaved: (compositionId: string, videoDurationSec: number) => void;
  onVideoRemoved: (compositionId: string) => void;
  onVideoUrl: (compositionId: string, url: string) => void;
}) => {
  const { video } = useRootStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const mayRefreshUrl = useAttemptThrottle(URL_REFRESH_INTERVAL_MS);
  const [replacing, setReplacing] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const refreshingRef = useRef(false);
  const [deleteMessages, setDeleteMessages] = useState<readonly string[]>([]);
  const [urlMessages, setUrlMessages] = useState<readonly string[]>([]);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  // Загрузка замены в редакторе: пока она идёт, замену и удаление не начать.
  const [uploading, setUploading] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  // Новая ссылка или версия видео снимает прежние ошибки воспроизведения
  // и получения ссылки. Композицию блок не меняет: его пересоздаёт `key`.
  const stateKey = `${videoUrl ?? ''}:${String(videoVersion)}`;
  const [seenKey, setSeenKey] = useState(stateKey);
  if (stateKey !== seenKey) {
    setSeenKey(stateKey);
    setPlaybackFailed(false);
    setUrlMessages((current) => (current.length === 0 ? current : []));
  }

  const hasVideo = videoUrl !== null || videoDurationSec !== null;
  if (!hasVideo && replacing) {
    setReplacing(false);
  }

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (videoUrl !== null || videoDurationSec === null) {
      return;
    }

    let cancelled = false;
    void video
      .getUrl(compositionId)
      .then((url) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }
        if (url === null) {
          onVideoRemoved(compositionId);
          return;
        }
        onVideoUrl(compositionId, url);
      })
      .catch((error: unknown) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }
        setUrlMessages(messagesFromError(error));
      });

    return () => {
      cancelled = true;
    };
  }, [
    compositionId,
    onVideoRemoved,
    onVideoUrl,
    video,
    videoDurationSec,
    videoUrl,
    videoVersion,
    retryToken,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!active) {
      videoRef.current?.pause();
    }
  }, [active]);

  const openReplace = () => {
    setReplaceOpen(true);
  };

  const closeReplace = () => {
    setReplaceOpen(false);
  };

  const continueReplace = () => {
    // Старый плеер молчит, пока в редакторе играет превью нового файла.
    videoRef.current?.pause();
    setReplaceOpen(false);
    setReplacing(true);
  };

  // Выход из замены без сохранения: прежнее видео и `full` не затронуты.
  const cancelReplace = () => {
    setReplacing(false);
  };

  const openDelete = () => {
    setDeleteMessages([]);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteMessages([]);
    setDeleteOpen(false);
  };

  const confirmDelete = async () => {
    if (busyRef.current || uploading) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setDeleteMessages([]);
    try {
      await video.remove(compositionId);
      requestIdRef.current += 1;
      onVideoRemoved(compositionId);
      if (!mountedRef.current) {
        return;
      }
      setReplacing(false);
      setDeleteOpen(false);
    } catch (error) {
      if (mountedRef.current) {
        setDeleteMessages(messagesFromError(error));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };

  const handleSaved = (savedCompositionId: string, durationSec: number) => {
    requestIdRef.current += 1;
    onVideoSaved(savedCompositionId, durationSec);
    if (mountedRef.current) {
      setReplacing(false);
    }
  };

  // Один обновляющий запрос за раз: «Повторить» не плодит параллельные GET.
  const refreshUrl = () => {
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    const requestId = requestIdRef.current;
    setPlaybackFailed(false);
    setUrlMessages((current) => (current.length === 0 ? current : []));
    void video
      .getUrl(compositionId)
      .then((url) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        if (url === null) {
          onVideoRemoved(compositionId);
          return;
        }
        if (url === videoUrl) {
          setPlaybackFailed(true);
          return;
        }
        onVideoUrl(compositionId, url);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        setUrlMessages(messagesFromError(error));
        setPlaybackFailed(true);
      })
      .finally(() => {
        refreshingRef.current = false;
      });
  };

  const handlePlaybackError = () => {
    if (!mayRefreshUrl(`${compositionId}:${String(videoVersion)}`)) {
      setPlaybackFailed(true);
      return;
    }
    refreshUrl();
  };

  // Ссылки нет: перезапускается эффект запроса. Ссылка есть, но просрочена и
  // обновление не удалось: повторяем его в обход троттлинга по явной просьбе.
  const retryUrl = () => {
    setUrlMessages([]);
    if (videoUrl === null) {
      setRetryToken((value) => value + 1);
      return;
    }
    refreshUrl();
  };

  return {
    videoRef,
    hasVideo,
    replacing,
    replaceOpen,
    deleteOpen,
    busy,
    actionsLocked: busy || uploading,
    setUploading,
    deleteMessages,
    urlMessages,
    playbackFailed,
    openReplace,
    closeReplace,
    continueReplace,
    cancelReplace,
    openDelete,
    closeDelete,
    confirmDelete,
    retryUrl,
    handleSaved,
    handlePlaybackError,
  };
};
