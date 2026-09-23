import { Box, Button, TextField, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error.ts';
import { normalizeEmail } from '../lib/normalize-email.ts';
import { useRootStore } from '../stores/root-store-context.tsx';

export const LoginPage = observer(function LoginPage({
  restoreMessages = null,
}: {
  restoreMessages?: readonly string[] | null;
}) {
  const { session } = useRootStore();
  const [email, setEmail] = useState(session.email ?? '');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<readonly string[]>(
    restoreMessages ?? [],
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeEmail(email);
    if (normalized === undefined) {
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await session.login(normalized, password);
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
        label="Email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
        autoComplete="username"
      />
      <TextField
        label="Пароль"
        type="password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
        autoComplete="current-password"
      />
      {messages.map((message, index) => (
        <Typography key={`${index}:${message}`} color="error">
          {message}
        </Typography>
      ))}
      <Button type="submit" variant="contained" disabled={submitting}>
        Войти
      </Button>
    </Box>
  );
});
