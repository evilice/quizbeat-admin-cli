import { Box, Button, TextField, Typography } from '@mui/material';
import type { SubmitEvent } from 'react';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';

type ChangePasswordFormProps = {
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  success: boolean;
  messages: readonly string[];
  submitting: boolean;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void | Promise<void>;
};

export const ChangePasswordForm = ({
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  success,
  messages,
  submitting,
  onSubmit,
}: ChangePasswordFormProps) => {
  return (
    <Box
      component="form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 360 }}
    >
      <TextField
        label="Текущий пароль"
        type="password"
        value={currentPassword}
        onChange={(event) => {
          onCurrentPasswordChange(event.target.value);
        }}
        autoComplete="current-password"
      />
      <TextField
        label="Новый пароль"
        type="password"
        value={newPassword}
        onChange={(event) => {
          onNewPasswordChange(event.target.value);
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
};
