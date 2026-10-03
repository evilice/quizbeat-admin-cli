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
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import type { StaffRole } from '../../session/parse-access-token.ts';
import { ROLE_LABELS } from '../admin-display.ts';
import { useCreateAdmin } from './use-create-admin.ts';

type CreateAdminDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export const CreateAdminDialog = ({
  open,
  onClose,
  onCreated,
}: CreateAdminDialogProps) => {
  const {
    email,
    setEmail,
    password,
    setPassword,
    role,
    setRole,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  } = useCreateAdmin(onClose, onCreated);

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
};
