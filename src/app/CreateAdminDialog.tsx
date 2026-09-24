import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error.ts';
import type { StaffRole } from '../stores/parse-access-token.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { ErrorMessages } from './ErrorMessages.tsx';

const MIN_PASSWORD_LENGTH = 8;

const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Админ',
  SUPER_ADMIN: 'Супер-админ',
};

type CreateAdminDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateAdminDialog({
  open,
  onClose,
  onCreated,
}: CreateAdminDialogProps) {
  const { admins } = useRootStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('ADMIN');
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setEmail('');
    setPassword('');
    setRole('ADMIN');
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

    if (email.trim() === '') {
      setMessages(['Укажите email']);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessages([
        `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
      ]);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await admins.create({ email: email.trim(), password, role });
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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <DialogTitle>Создать сотрудника</DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            autoComplete="off"
            fullWidth
            margin="dense"
          />
          <TextField
            label="Пароль"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            autoComplete="new-password"
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="create-admin-role-label">Роль</InputLabel>
            <Select
              labelId="create-admin-role-label"
              label="Роль"
              value={role}
              onChange={(event) => {
                setRole(event.target.value as StaffRole);
              }}
            >
              <MenuItem value="ADMIN">{ROLE_LABELS.ADMIN}</MenuItem>
              <MenuItem value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</MenuItem>
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
