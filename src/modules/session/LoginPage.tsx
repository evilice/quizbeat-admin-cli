import { observer } from 'mobx-react-lite';
import { LoginForm } from './login/LoginForm.tsx';
import { useLogin } from './login/use-login.ts';

type LoginPageProps = {
  restoreMessages?: readonly string[] | null;
};

export const LoginPage = observer(
  ({ restoreMessages = null }: LoginPageProps) => {
    const {
      email,
      setEmail,
      password,
      setPassword,
      messages,
      submitting,
      handleSubmit,
    } = useLogin(restoreMessages);

    return (
      <LoginForm
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        messages={messages}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    );
  },
);
