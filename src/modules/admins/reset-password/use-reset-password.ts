import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import {
  MIN_PASSWORD_LENGTH,
  passwordTooShortMessage,
} from '../admin-display.ts';
import type { Admin } from '../admins-store.ts';

export const useResetPassword = (
  admin: Admin | null,
  onClose: () => void,
  onReset: (adminId: string) => void,
) => {
  const { admins } = useRootStore();
  const [newPassword, setNewPassword] = useState('');
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setNewPassword('');
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
    if (admin === null) {
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessages([passwordTooShortMessage()]);
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
      setMessages(messagesFromError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    newPassword,
    setNewPassword,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  };
};
