import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
} from '@mui/material';
import { useState, type SubmitEvent } from 'react';
import { ApiError } from '../../shared/api/api-error.ts';
import type { CompositionStatus } from './compositions-store.ts';
import type { Tag } from '../../modules/tags/tags-store.ts';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import { STATUS_LABELS, tagDisplayName } from './composition-display.ts';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';

type CreateCompositionDialogProps = {
  open: boolean;
  tagOptions: Tag[];
  onClose: () => void;
  onCreated: () => void;
};

export function CreateCompositionDialog({
  open,
  tagOptions,
  onClose,
  onCreated,
}: CreateCompositionDialogProps) {
  const { compositions } = useRootStore();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<CompositionStatus>('DRAFT');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle('');
    setAuthor('');
    setStatus('DRAFT');
    setSelectedTagIds([]);
    setMessages([]);
  }

  function handleClose() {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
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
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <DialogTitle>Создать композицию</DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
        >
          <TextField
            label="Название"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            autoComplete="off"
            fullWidth
            margin="dense"
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
            <InputLabel id="create-composition-status-label">Статус</InputLabel>
            <Select
              labelId="create-composition-status-label"
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
            <InputLabel id="create-composition-tags-label">Теги</InputLabel>
            <Select
              labelId="create-composition-tags-label"
              label="Теги"
              multiple
              value={selectedTagIds}
              input={<OutlinedInput label="Теги" />}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTagIds(
                  typeof value === 'string' ? value.split(',') : value,
                );
              }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((id) => {
                    const tag = tagOptions.find((item) => item.id === id);
                    return (
                      <Chip
                        key={id}
                        size="small"
                        label={tag ? tagDisplayName(tag) : id}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Создать
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
