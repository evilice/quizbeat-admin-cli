import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { STATUS_LABELS, tagDisplayName } from '../composition-display.ts';
import type {
  Composition,
  CompositionFull,
  CompositionStatus,
} from '../compositions-store.ts';
import type { Tag } from '../../tags/tags-store.ts';
import { useEditComposition } from './use-edit-composition.ts';

type CompositionEditFormProps = {
  composition: CompositionFull;
  tagOptions: Tag[];
  onSaved: (updated: Composition) => void;
};

export const CompositionEditForm = ({
  composition,
  tagOptions,
  onSaved,
}: CompositionEditFormProps) => {
  const {
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
  } = useEditComposition(composition, onSaved);

  return (
    <Box
      component="form"
      data-testid="composition-card-form"
      data-clips-count={String(composition.clips.length)}
      data-images-count={String(composition.images.length)}
      data-notes-count={String(composition.notes.length)}
      data-original-audio-url={composition.originalAudioUrl ?? ''}
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
        <Select<CompositionStatus>
          labelId="composition-card-status-label"
          label="Статус"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
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
                  composition.tags.find((item) => item.id === tagId);
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
      <ErrorMessages messages={messages} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button type="submit" variant="contained" disabled={saving}>
          Сохранить
        </Button>
        <Button component={Link} to="/compositions" disabled={saving}>
          К списку
        </Button>
      </Box>
    </Box>
  );
};
