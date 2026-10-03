import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { useLastAdmin } from '../use-last-admin.ts';
import { DEACTIVATE_CONFIRM_TEXT } from '../admin-display.ts';
import type { Admin } from '../admins-store.ts';

type DeactivateAdminDialogProps = {
  admin: Admin | null;
  pending: boolean;
  messages: readonly string[];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export const DeactivateAdminDialog = ({
  admin,
  pending,
  messages,
  onClose,
  onConfirm,
}: DeactivateAdminDialogProps) => {
  const shownAdmin = useLastAdmin(admin);

  return (
    <Dialog open={admin !== null} onClose={onClose}>
      <DialogTitle>Деактивировать {shownAdmin?.email ?? ''}?</DialogTitle>
      <DialogContent>
        <DialogContentText>{DEACTIVATE_CONFIRM_TEXT}</DialogContentText>
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
          Деактивировать
        </Button>
      </DialogActions>
    </Dialog>
  );
};
