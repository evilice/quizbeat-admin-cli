import { useState, type SubmitEvent } from 'react';
import { ApiError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { CompositionStatus } from '../compositions-store.ts';

export const useCreateComposition = (
  onClose: () => void,
  onCreated: () => void,
) => {
  const { compositions } = useRootStore();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<CompositionStatus>('DRAFT');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setStatus('DRAFT');
    setSelectedTagIds([]);
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

    if (title === '') {
      setMessages(['Укажите название']);
      return;
    }
    if (author === '') {
      setMessages(['Укажите автора']);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await compositions.create({
        title,
        author,
        ...(status === 'PUBLISHED' ? { status: 'PUBLISHED' as const } : {}),
        ...(selectedTagIds.length > 0 ? { tagIds: selectedTagIds } : {}),
      });
      resetForm();
      onCreated();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    title,
    setTitle,
    author,
    setAuthor,
    status,
    setStatus,
    selectedTagIds,
    setSelectedTagIds,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  };
};
