import { useState, type SubmitEvent } from 'react';
import { ApiError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type {
  Composition,
  CompositionFull,
  CompositionStatus,
  UpdateCompositionInput,
} from '../compositions-store.ts';

export const useEditComposition = (
  composition: CompositionFull,
  onSaved: (updated: Composition) => void,
) => {
  const { compositions } = useRootStore();
  const [title, setTitle] = useState(composition.title);
  const [author, setAuthor] = useState(composition.author);
  const [status, setStatus] = useState<CompositionStatus>(composition.status);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    composition.tags.map((tag) => tag.id),
  );
  const [tagsTouched, setTagsTouched] = useState(false);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);

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

    const input: UpdateCompositionInput = {
      title,
      author,
      status,
    };
    if (tagsTouched) {
      input.tagIds = selectedTagIds;
    }

    setSaving(true);
    setMessages([]);
    try {
      const updated = await compositions.update(composition.id, input);
      setTitle(updated.title);
      setAuthor(updated.author);
      setStatus(updated.status);
      setSelectedTagIds(updated.tags.map((tag) => tag.id));
      setTagsTouched(false);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setSaving(false);
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
    setTagsTouched,
    messages,
    saving,
    handleSubmit,
  };
};
