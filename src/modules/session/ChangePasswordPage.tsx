import { observer } from 'mobx-react-lite';
import { ChangePasswordForm } from './change-password/ChangePasswordForm.tsx';
import { useChangePassword } from './change-password/use-change-password.ts';

export const ChangePasswordPage = observer(() => {
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    messages,
    success,
    submitting,
    handleSubmit,
  } = useChangePassword();

  return (
    <ChangePasswordForm
      currentPassword={currentPassword}
      onCurrentPasswordChange={setCurrentPassword}
      newPassword={newPassword}
      onNewPasswordChange={setNewPassword}
      success={success}
      messages={messages}
      submitting={submitting}
      onSubmit={handleSubmit}
    />
  );
});
