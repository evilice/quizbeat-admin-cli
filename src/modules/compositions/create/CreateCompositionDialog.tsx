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
import type { CompositionStatus } from '../compositions-store.ts';
import { STATUS_LABELS, tagDisplayName } from '../composition-display.ts';
import type { Tag } from '../../tags/tags-store.ts';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { useCreateComposition } from './use-create-composition.ts';

type CreateCompositionDialogProps = {
  open: boolean;
  tagOptions: Tag[];
  onClose: () => void;
  onCreated: () => void;
};

export const CreateCompositionDialog = ({
  open,
  tagOptions,
  onClose,
  onCreated,
}: CreateCompositionDialogProps) => {
  const {
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
  } = useCreateComposition(onClose, onCreated);

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
            <Select<CompositionStatus>
              labelId="create-composition-status-label"
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
};
