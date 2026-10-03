import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ApiError } from '../../shared/api/api-error.ts';
import {
  type Composition,
  type CompositionFull,
  type CompositionStatus,
  type UpdateCompositionInput,
} from './compositions-store.ts';
import type { Tag } from '../../modules/tags/tags-store.ts';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import { AudioUploadBlock } from './audio/AudioUploadBlock.tsx';
import { ClipsListBlock } from './audio/ClipsListBlock.tsx';
import { STATUS_LABELS, tagDisplayName } from './composition-display.ts';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { ImagesBlock } from './images/ImagesBlock.tsx';
import { NotesBlock } from './notes/NotesBlock.tsx';
import { WaveformPointsBlock } from './audio/WaveformPointsBlock.tsx';

export type CompositionLocationState = {
  title?: string;
  author?: string;
};

const TAGS_FILTER_LIMIT = 100;
const NOT_FOUND_MESSAGE = 'Композиция не найдена';

export const CompositionCardPage = observer(function CompositionCardPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = location.state as CompositionLocationState | null;
  const { compositions, tags } = useRootStore();

  const [full, setFull] = useState<CompositionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadMessages, setLoadMessages] = useState<readonly string[]>([]);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<CompositionStatus>('DRAFT');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagsTouched, setTagsTouched] = useState(false);
  const [tagOptions, setTagOptions] = useState<Tag[]>([]);
  const [saveMessages, setSaveMessages] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);
  const [clipsReloadToken, setClipsReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void tags
      .list({ limit: TAGS_FILTER_LIMIT })
      .then((pageResult) => {
        if (!cancelled) {
          setTagOptions(pageResult.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTagOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tags]);

  useEffect(() => {
    if (id === undefined || id === '') {
      setLoading(false);
      setNotFound(true);
      setFull(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadMessages([]);
    setSaveMessages([]);
    setFull(null);
    setTagsTouched(false);
    setClipsReloadToken(0);

    void compositions
      .full(id)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setFull(result);
        setTitle(result.title);
        setAuthor(result.author);
        setStatus(result.status);
        setSelectedTagIds(result.tags.map((tag) => tag.id));
        setTagsTouched(false);
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
        if (error instanceof ApiError) {
          setLoadMessages(error.messages);
        }
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (id === undefined || id === '' || full === null) {
      return;
    }

    if (title === '') {
      setSaveMessages(['Укажите название']);
      return;
    }
    if (author === '') {
      setSaveMessages(['Укажите автора']);
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
    setSaveMessages([]);
    try {
      const updated = await compositions.update(id, input);
      setFull((current) =>
        current === null ? null : mergeCompositionIntoFull(current, updated),
      );
      setTitle(updated.title);
      setAuthor(updated.author);
      setStatus(updated.status);
      setSelectedTagIds(updated.tags.map((tag) => tag.id));
      setTagsTouched(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setSaveMessages(error.messages);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAudioUploaded(durationSec: number) {
    setFull((current) =>
      current === null
        ? null
        : {
            ...current,
            originalAudioDurationSec: durationSec,
            originalAudioUrl: null,
          },
    );
    setClipsReloadToken((value) => value + 1);
  }

  function handlePointsCreated() {
    setClipsReloadToken((value) => value + 1);
  }

  const headerTitle = full?.title ?? locationState?.title;
  const headerAuthor = full?.author ?? locationState?.author;

  if (notFound) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography>{NOT_FOUND_MESSAGE}</Typography>
        <Button component={Link} to="/compositions">
          К списку композиций
        </Button>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {headerTitle !== undefined || headerAuthor !== undefined ? (
          <Typography variant="h5" component="h1">
            {[headerTitle, headerAuthor].filter(Boolean).join(' — ')}
          </Typography>
        ) : null}
        <CircularProgress aria-label="Загрузка композиции" />
      </Box>
    );
  }

  if (loadMessages.length > 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ErrorMessages messages={loadMessages} />
        <Button component={Link} to="/compositions">
          К списку композиций
        </Button>
      </Box>
    );
  }

  if (full === null) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box
        component="form"
        data-testid="composition-card-form"
        data-clips-count={String(full.clips.length)}
        data-images-count={String(full.images.length)}
        data-notes-count={String(full.notes.length)}
        data-original-audio-url={full.originalAudioUrl ?? ''}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}
      >
        <Typography variant="h5" component="h1">
          {title}
          {author !== '' ? ` — ${author}` : ''}
        </Typography>
        <TextField
          label="Название"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          autoComplete="off"
          fullWidth
        />
        <TextField
          label="Автор"
          value={author}
          onChange={(event) => {
            setAuthor(event.target.value);
          }}
          autoComplete="off"
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel id="composition-card-status-label">Статус</InputLabel>
          <Select
            labelId="composition-card-status-label"
            label="Статус"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CompositionStatus);
            }}
          >
            <MenuItem value="DRAFT">{STATUS_LABELS.DRAFT}</MenuItem>
            <MenuItem value="PUBLISHED">{STATUS_LABELS.PUBLISHED}</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="composition-card-tags-label">Теги</InputLabel>
          <Select
            labelId="composition-card-tags-label"
            label="Теги"
            multiple
            value={selectedTagIds}
            input={<OutlinedInput label="Теги" />}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTagIds(
                typeof value === 'string' ? value.split(',') : value,
              );
              setTagsTouched(true);
            }}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((tagId) => {
                  const tag =
                    tagOptions.find((item) => item.id === tagId) ??
                    full.tags.find((item) => item.id === tagId);
                  return (
                    <Chip
                      key={tagId}
                      size="small"
                      label={tag ? tagDisplayName(tag) : tagId}
                    />
                  );
                })}
              </Box>
            )}
          >
            {tagOptions.map((tag) => (
              <MenuItem key={tag.id} value={tag.id}>
                {tagDisplayName(tag)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ErrorMessages messages={saveMessages} />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button type="submit" variant="contained" disabled={saving}>
            Сохранить
          </Button>
          <Button component={Link} to="/compositions" disabled={saving}>
            К списку
          </Button>
        </Box>
      </Box>
      <AudioUploadBlock
        compositionId={full.id}
        originalAudioUrl={full.originalAudioUrl}
        originalAudioDurationSec={full.originalAudioDurationSec}
        onUploaded={handleAudioUploaded}
      />
      <WaveformPointsBlock
        compositionId={full.id}
        originalAudioUrl={full.originalAudioUrl}
        originalAudioDurationSec={full.originalAudioDurationSec}
        onPointsCreated={handlePointsCreated}
      />
      <ClipsListBlock
        compositionId={full.id}
        initialClips={full.clips}
        reloadToken={clipsReloadToken}
      />
      <ImagesBlock compositionId={full.id} initialImages={full.images} />
      <NotesBlock compositionId={full.id} initialNotes={full.notes} />
    </Box>
  );
});

function mergeCompositionIntoFull(
  current: CompositionFull,
  updated: Composition,
): CompositionFull {
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
}
