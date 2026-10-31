import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { CompositionArtist } from '../../artists/artists-store.ts';
import type { CompositionStatus } from '../compositions-store.ts';

export const useCreateComposition = (
  onClose: () => void,
  onCreated: () => void,
) => {
  const { compositions } = useRootStore();
  const [title, setTitle] = useState('');
  const [artists, setArtists] = useState<CompositionArtist[]>([]);
  const [status, setStatus] = useState<CompositionStatus>('DRAFT');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [artistCreating, setArtistCreating] = useState(false);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setArtists([]);
    setStatus('DRAFT');
    setSelectedTagIds([]);
    setMessages([]);
  };

  const handleClose = () => {
    if (submitting || artistCreating) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (artistCreating) {
      return;
    }

    const trimmedTitle = title.trim();

    if (trimmedTitle === '') {
      setMessages(['Укажите название']);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await compositions.create({
        title: trimmedTitle,
        ...(artists.length > 0
          ? { artistIds: artists.map((artist) => artist.id) }
          : {}),
        ...(status === 'PUBLISHED' ? { status: 'PUBLISHED' as const } : {}),
        ...(selectedTagIds.length > 0 ? { tagIds: selectedTagIds } : {}),
      });
      resetForm();
      onCreated();
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    title,
    setTitle,
    artists,
    setArtists,
    status,
    setStatus,
    selectedTagIds,
    setSelectedTagIds,
    artistCreating,
    setArtistCreating,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  };
};
