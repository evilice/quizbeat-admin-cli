import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { StaffRole } from '../../session/parse-access-token.ts';
import {
  MIN_PASSWORD_LENGTH,
  passwordTooShortMessage,
} from '../admin-display.ts';

export const useCreateAdmin = (onClose: () => void, onCreated: () => void) => {
  const { admins } = useRootStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('ADMIN');
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setRole('ADMIN');
    setMessages([]);
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (email.trim() === '') {
      setMessages(['Укажите email']);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessages([passwordTooShortMessage()]);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await admins.create({ email: email.trim(), password, role });
      resetForm();
      onCreated();
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
    role,
    setRole,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  };
};
