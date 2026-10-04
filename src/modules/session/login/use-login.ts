import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import { normalizeEmail } from '../normalize-email.ts';

export const useLogin = (restoreMessages: readonly string[] | null) => {
  const { session } = useRootStore();
  const [email, setEmail] = useState(session.email ?? '');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<readonly string[]>(
    restoreMessages ?? [],
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
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
      setMessages(messagesFromError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    messages,
    submitting,
    handleSubmit,
  };
};
