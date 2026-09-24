import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error.ts';
import type { Admin } from '../stores/admins-store.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { ErrorMessages } from './ErrorMessages.tsx';

const MIN_PASSWORD_LENGTH = 8;

type ResetPasswordDialogProps = {
  admin: Admin | null;
  onClose: () => void;
  onReset: (adminId: string) => void;
};

export function ResetPasswordDialog({
  admin,
  onClose,
  onReset,
}: ResetPasswordDialogProps) {
  const { admins } = useRootStore();
  const [newPassword, setNewPassword] = useState('');
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setNewPassword('');
    setMessages([]);
  }

  function handleClose() {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (admin === null) {
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessages([
        `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
      ]);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await admins.resetPassword(admin.id, newPassword);
      const targetId = admin.id;
      resetForm();
      onReset(targetId);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={admin !== null} onClose={handleClose} fullWidth maxWidth="xs">
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <DialogTitle>Сбросить пароль {admin?.email ?? ''}</DialogTitle>
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
}
