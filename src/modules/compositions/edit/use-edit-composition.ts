import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { CompositionArtist } from '../../artists/artists-store.ts';
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
  const [artists, setArtists] = useState<CompositionArtist[]>(
    composition.artists,
  );
  const [status, setStatus] = useState<CompositionStatus>(composition.status);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    composition.tags.map((tag) => tag.id),
  );
  const [tagsTouched, setTagsTouched] = useState(false);
  const [artistsTouched, setArtistsTouched] = useState(false);
  const [artistCreating, setArtistCreating] = useState(false);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);

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

    const input: UpdateCompositionInput = {
      title: trimmedTitle,
      status,
    };
    if (tagsTouched) {
      input.tagIds = selectedTagIds;
    }
    if (artistsTouched) {
      input.artistIds = artists.map((artist) => artist.id);
    }

    setSaving(true);
    setMessages([]);
    try {
      const updated = await compositions.update(composition.id, input);
      setTitle(updated.title);
      setArtists(updated.artists);
      setStatus(updated.status);
      setSelectedTagIds(updated.tags.map((tag) => tag.id));
      setTagsTouched(false);
      setArtistsTouched(false);
      onSaved(updated);
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setSaving(false);
    }
  };

  const changeArtists = (next: CompositionArtist[]) => {
    setArtists(next);
    setArtistsTouched(true);
  };

  return {
    title,
    setTitle,
    artists,
    changeArtists,
    status,
    setStatus,
    selectedTagIds,
    setSelectedTagIds,
    setTagsTouched,
    artistCreating,
    setArtistCreating,
    messages,
    saving,
    handleSubmit,
  };
};
