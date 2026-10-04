import { useState, type SubmitEvent } from 'react';
import { ApiError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';

const MIN_PASSWORD_LENGTH = 8;
const INVALID_CURRENT_PASSWORD = 'Current password is incorrect';
const CHANGE_OWN_PASSWORD_PATH = '/admins/me/password';

const isIncorrectCurrentPassword = (error: ApiError): boolean => {
  return error.messages.includes(INVALID_CURRENT_PASSWORD);
};

export const useChangePassword = () => {
  const { session } = useRootStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
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
  };

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    messages,
    success,
    submitting,
    handleSubmit,
  };
};
