import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { Artist } from '../artists-store.ts';

export const useArtistForm = (
  artist: Artist | null,
  onClose: () => void,
  onSaved: () => void,
) => {
  const { artists } = useRootStore();
  const [name, setName] = useState(artist?.name ?? '');
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setMessages([]);
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();

    if (trimmedName === '') {
      setMessages(['Укажите имя']);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      if (artist === null) {
        await artists.create({ name: trimmedName });
      } else {
        await artists.update(artist.id, { name: trimmedName });
      }
      resetForm();
      onSaved();
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    name,
    setName,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  };
};
