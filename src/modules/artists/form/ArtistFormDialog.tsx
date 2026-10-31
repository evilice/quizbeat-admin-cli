import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { ARTIST_RENAME_HINT } from '../artists-display.ts';
import type { Artist } from '../artists-store.ts';
import { useArtistForm } from './use-artist-form.ts';

type ArtistFormDialogProps = {
  open: boolean;
  artist: Artist | null;
  onClose: () => void;
  onSaved: () => void;
};

export const ArtistFormDialog = ({
  open,
  artist,
  onClose,
  onSaved,
}: ArtistFormDialogProps) => {
  const { name, setName, messages, submitting, handleClose, handleSubmit } =
    useArtistForm(artist, onClose, onSaved);

  const isEdit = artist !== null;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <DialogTitle>
          {isEdit ? 'Изменить исполнителя' : 'Создать исполнителя'}
        </DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
        >
          <TextField
            label="Имя"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            autoComplete="off"
            fullWidth
            margin="dense"
          />
          {isEdit ? (
            <Typography variant="body2" color="text.secondary">
              {ARTIST_RENAME_HINT}
            </Typography>
          ) : null}
          <ErrorMessages messages={messages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
