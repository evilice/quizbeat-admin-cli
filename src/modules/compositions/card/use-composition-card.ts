import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { ApiError, messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { Composition, CompositionFull } from '../compositions-store.ts';
import { useTagOptions } from '../use-tag-options.ts';

export type CompositionLocationState = {
  title?: string;
  author?: string;
};

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
  const [trackedId, setTrackedId] = useState(id);
  const missingId = id === undefined || id === '';

  if (id !== trackedId) {
    setTrackedId(id);
    setFull(null);
    setLoading(!missingId);
    setNotFound(false);
    setLoadMessages([]);
    setClipsReloadToken(0);
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
    applySaved,
    handleAudioUploaded,
    handlePointsCreated,
  };
};
