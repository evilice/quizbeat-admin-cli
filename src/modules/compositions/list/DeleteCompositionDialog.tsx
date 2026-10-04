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
import { DELETE_COMPOSITION_CONFIRM_TEXT } from '../composition-display.ts';
import type { Composition } from '../compositions-store.ts';

type DeleteCompositionDialogProps = {
  composition: Composition | null;
  pending: boolean;
  messages: readonly string[];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export const DeleteCompositionDialog = ({
  composition,
  pending,
  messages,
  onClose,
  onConfirm,
}: DeleteCompositionDialogProps) => {
  const shown = useLastValue(composition);

  return (
    <Dialog open={composition !== null} onClose={onClose}>
      <DialogTitle>Удалить {shown?.title ?? ''}?</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography component="p" sx={{ m: 0 }}>
            Автор: {shown?.author ?? ''}
          </Typography>
          <Typography component="p" sx={{ mt: 1, mb: 0 }}>
            {DELETE_COMPOSITION_CONFIRM_TEXT}
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
