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
import { STORAGE_PENDING_MESSAGE, filesSummary } from '../storage-display.ts';

type SweepConfirmDialogProps = {
  open: boolean;
  count: number | null;
  bytes: number | null;
  pending: boolean;
  messages: readonly string[];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export const SweepConfirmDialog = ({
  open,
  count,
  bytes,
  pending,
  messages,
  onClose,
  onConfirm,
}: SweepConfirmDialogProps) => {
  const shownCount = useLastValue(count);
  const shownBytes = useLastValue(bytes);
  const summary =
    shownCount === null || shownBytes === null
      ? ''
      : filesSummary(shownCount, shownBytes);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Удалить файлы хранилища?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {`По проверке будет удалено ${summary}. Сервер пересчитает набор при удалении, итог может отличаться. Восстановить файлы нельзя.`}
        </DialogContentText>
        {pending ? (
          <Typography role="status">{STORAGE_PENDING_MESSAGE}</Typography>
        ) : null}
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
