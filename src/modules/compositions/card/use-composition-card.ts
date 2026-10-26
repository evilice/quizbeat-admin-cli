import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { ApiError, messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { Composition, CompositionFull } from '../compositions-store.ts';
import { useTagOptions } from '../use-tag-options.ts';

export type CompositionLocationState = {
  title?: string;
  author?: string;
};

export type CompositionCardTab =
  'general' | 'audio' | 'images' | 'notes' | 'video';

const mergeCompositionIntoFull = (
  current: CompositionFull,
  updated: Composition,
): CompositionFull => {
  return {
    ...current,
    id: updated.id,
    title: updated.title,
    author: updated.author,
    status: updated.status,
    createdById: updated.createdById,
    tags: updated.tags,
    deletedAt: updated.deletedAt,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
};

export const useCompositionCard = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = location.state as CompositionLocationState | null;
  const { compositions } = useRootStore();
  const { tagOptions, tagMessages } = useTagOptions();

  const [full, setFull] = useState<CompositionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadMessages, setLoadMessages] = useState<readonly string[]>([]);
  const [clipsReloadToken, setClipsReloadToken] = useState(0);
  const [audioVersion, setAudioVersion] = useState(0);
  const [videoVersionState, setVideoVersionState] = useState({
    compositionId: id,
    value: 0,
  });
  const [tab, setTab] = useState<CompositionCardTab>('general');
  const [trackedId, setTrackedId] = useState(id);
  const missingId = id === undefined || id === '';

  if (id !== trackedId) {
    setTrackedId(id);
    setFull(null);
    setLoading(!missingId);
    setNotFound(false);
    setLoadMessages([]);
    setClipsReloadToken(0);
    setVideoVersionState({ compositionId: id, value: 0 });
    setTab('general');
  }

  useEffect(() => {
    if (id === undefined || id === '') {
      return;
    }

    let cancelled = false;

    void compositions
      .full(id)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setFull(result);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setFull(null);
        if (error instanceof ApiError && error.status === 404) {
          setNotFound(true);
          return;
        }
        setLoadMessages(messagesFromError(error));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compositions, id]);

  const applySaved = (updated: Composition) => {
    setFull((current) =>
      current === null ? null : mergeCompositionIntoFull(current, updated),
    );
  };

  const handleAudioUploaded = (durationSec: number) => {
    setFull((current) =>
      current === null
        ? null
        : {
            ...current,
            originalAudioDurationSec: durationSec,
            originalAudioUrl: null,
          },
    );
    setAudioVersion((value) => value + 1);
    setClipsReloadToken((value) => value + 1);
  };

  const handlePointsCreated = () => {
    setClipsReloadToken((value) => value + 1);
  };

  // Ссылка сбрасывается до GET: иначе плеер на миг покажет уже заменённый файл.
  // Апдейтеры чистые. Версия растёт только у своей композиции: поздний
  // ответ чужой не должен перезапускать запрос ссылки в текущей карточке.
  const bumpVideoVersion = useCallback((compositionId: string) => {
    setVideoVersionState((current) =>
      current.compositionId === compositionId
        ? { compositionId, value: current.value + 1 }
        : current,
    );
  }, []);

  const handleVideoSaved = useCallback(
    (compositionId: string, videoDurationSec: number) => {
      setFull((current) =>
        current === null || current.id !== compositionId
          ? current
          : { ...current, videoDurationSec, videoUrl: null },
      );
      bumpVideoVersion(compositionId);
    },
    [bumpVideoVersion],
  );

  const handleVideoRemoved = useCallback(
    (compositionId: string) => {
      setFull((current) =>
        current === null || current.id !== compositionId
          ? current
          : { ...current, videoDurationSec: null, videoUrl: null },
      );
      bumpVideoVersion(compositionId);
    },
    [bumpVideoVersion],
  );

  const handleVideoUrl = useCallback((compositionId: string, url: string) => {
    setFull((current) =>
      current === null ||
      current.id !== compositionId ||
      current.videoDurationSec === null
        ? current
        : {
            ...current,
            videoUrl: url,
          },
    );
  }, []);

  const headerTitle = full?.title ?? locationState?.title;
  const headerAuthor = full?.author ?? locationState?.author;

  return {
    notFound: missingId || notFound,
    loading: missingId ? false : loading,
    loadMessages,
    headerTitle,
    headerAuthor,
    full: missingId ? null : full,
    tagOptions,
    tagMessages,
    clipsReloadToken,
    audioVersion,
    videoVersion: videoVersionState.value,
    tab,
    setTab,
    applySaved,
    handleAudioUploaded,
    handlePointsCreated,
    handleVideoSaved,
    handleVideoRemoved,
    handleVideoUrl,
  };
};
