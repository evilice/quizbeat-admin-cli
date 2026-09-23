import { Box, Button, TextField, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { ErrorMessages } from './ErrorMessages.tsx';

const MIN_PASSWORD_LENGTH = 8;
const INVALID_CURRENT_PASSWORD = 'Current password is incorrect';
const CHANGE_OWN_PASSWORD_PATH = '/admins/me/password';

function isIncorrectCurrentPassword(error: ApiError): boolean {
  return error.messages.includes(INVALID_CURRENT_PASSWORD);
}

export const ChangePasswordPage = observer(function ChangePasswordPage() {
  const { session } = useRootStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);

    if (currentPassword === '') {
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessages([
        `Новый пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
      ]);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await session.api.requestJson(CHANGE_OWN_PASSWORD_PATH, {
        method: 'PATCH',
        body: { currentPassword, newPassword },
        isNonTokenUnauthorized: isIncorrectCurrentPassword,
      });
      session.forgetRefresh();
      setCurrentPassword('');
      setNewPassword('');
      setSuccess(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 360 }}
    >
      <TextField
        label="Текущий пароль"
        type="password"
        value={currentPassword}
        onChange={(event) => {
          setCurrentPassword(event.target.value);
        }}
        autoComplete="current-password"
      />
      <TextField
        label="Новый пароль"
        type="password"
        value={newPassword}
        onChange={(event) => {
          setNewPassword(event.target.value);
        }}
        autoComplete="new-password"
      />
      {success ? (
        <Typography color="success.main">Пароль изменён</Typography>
      ) : null}
      <ErrorMessages messages={messages} />
      <Button type="submit" variant="contained" disabled={submitting}>
        Сменить пароль
      </Button>
    </Box>
  );
});
