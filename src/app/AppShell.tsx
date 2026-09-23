import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { ApiError } from '../api/api-error.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { LoginPage } from './LoginPage.tsx';

export const AppShell = observer(function AppShell() {
  const { session } = useRootStore();
  const [restorePending, setRestorePending] = useState(
    () =>
      hasRefresh(session.refreshToken) && !hasAccess(session.accessToken),
  );
  const [restoreMessages, setRestoreMessages] = useState<
    readonly string[] | null
  >(null);

  useEffect(() => {
    if (!hasRefresh(session.refreshToken) || hasAccess(session.accessToken)) {
      setRestorePending(false);
      return;
    }

    let cancelled = false;
    void session
      .restore()
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status !== 401) {
          setRestoreMessages(error.messages);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRestorePending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const signedIn = hasAccess(session.accessToken);

  return (
    <Box>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2 }}>
          <Typography component="h1" variant="h6" sx={{ flexGrow: 1 }}>
            Админка QuizBeat
          </Typography>
          {signedIn ? (
            <>
              <Typography component="span">{session.email}</Typography>
              <Button color="inherit" onClick={() => void session.logout()}>
                Выйти
              </Button>
            </>
          ) : null}
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 2 }}>
        {restorePending ? null : signedIn ? (
          <Outlet />
        ) : (
          <LoginPage restoreMessages={restoreMessages} />
        )}
      </Box>
    </Box>
  );
});

function hasRefresh(token: string | null): boolean {
  return token !== null && token !== '';
}

function hasAccess(token: string | null): boolean {
  return token !== null && token !== '';
}
