import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import type { Admin } from '../admins-store.ts';
import { useLastAdmin } from '../use-last-admin.ts';
import { useResetPassword } from './use-reset-password.ts';

type ResetPasswordDialogProps = {
  admin: Admin | null;
  onClose: () => void;
  onReset: (adminId: string) => void;
};

export const ResetPasswordDialog = ({
  admin,
  onClose,
  onReset,
}: ResetPasswordDialogProps) => {
  const {
    newPassword,
    setNewPassword,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  } = useResetPassword(admin, onClose, onReset);

  const shownAdmin = useLastAdmin(admin);

  return (
    <Dialog open={admin !== null} onClose={handleClose} fullWidth maxWidth="xs">
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <DialogTitle>Сбросить пароль {shownAdmin?.email ?? ''}</DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
        >
          <TextField
            label="Новый пароль"
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
            }}
            autoComplete="new-password"
            fullWidth
            margin="dense"
          />
          <ErrorMessages messages={messages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Сбросить пароль
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
