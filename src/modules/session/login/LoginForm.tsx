import { Box, Button, TextField } from '@mui/material';
import type { SubmitEvent } from 'react';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';

type LoginFormProps = {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  messages: readonly string[];
  submitting: boolean;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void | Promise<void>;
};

export const LoginForm = ({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  messages,
  submitting,
  onSubmit,
}: LoginFormProps) => {
  return (
    <Box
      component="form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 360 }}
    >
      <TextField
        label="Email"
        value={email}
        onChange={(event) => {
          onEmailChange(event.target.value);
        }}
        autoComplete="username"
      />
      <TextField
        label="Пароль"
        type="password"
        value={password}
        onChange={(event) => {
          onPasswordChange(event.target.value);
        }}
        autoComplete="current-password"
      />
      <ErrorMessages messages={messages} />
      <Button type="submit" variant="contained" disabled={submitting}>
        Войти
      </Button>
    </Box>
  );
};
