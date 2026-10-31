import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useLastValue } from '../../../shared/hooks/use-last-value.ts';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { DELETE_ARTIST_CONFIRM_TEXT } from '../artists-display.ts';
import type { Artist } from '../artists-store.ts';

type DeleteArtistDialogProps = {
  artist: Artist | null;
  pending: boolean;
  messages: readonly string[];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export const DeleteArtistDialog = ({
  artist,
  pending,
  messages,
  onClose,
  onConfirm,
}: DeleteArtistDialogProps) => {
  const shownArtist = useLastValue(artist);

  return (
    <Dialog open={artist !== null} onClose={onClose}>
      <DialogTitle>Удалить {shownArtist?.name ?? ''}?</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography component="p" sx={{ m: 0 }}>
            Имя: {shownArtist?.name ?? ''}
          </Typography>
          <Typography component="p" sx={{ mt: 1, mb: 0 }}>
            {DELETE_ARTIST_CONFIRM_TEXT}
          </Typography>
        </DialogContentText>
        <ErrorMessages messages={messages} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Отмена
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => {
            void onConfirm();
          }}
          disabled={pending}
        >
          Удалить
        </Button>
      </DialogActions>
    </Dialog>
  );
};
