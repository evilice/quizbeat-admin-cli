import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  SvgIcon,
  Toolbar,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { ApiError } from '../api/api-error.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { LoginPage } from './LoginPage.tsx';

const drawerWidth = 240;

export const AppShell = observer(function AppShell() {
  const { session } = useRootStore();
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [restorePending, setRestorePending] = useState(
    () => hasRefresh(session.refreshToken) && !hasAccess(session.accessToken),
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
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Typography component="h1" variant="h6" sx={{ flexGrow: 1 }}>
            Админка QuizBeat
          </Typography>
          {signedIn ? (
            <IconButton
              color="inherit"
              aria-label="Аккаунт"
              aria-haspopup="true"
              aria-expanded={accountAnchor !== null}
              onClick={(event) => {
                setAccountAnchor(event.currentTarget);
              }}
            >
              <SvgIcon>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </SvgIcon>
            </IconButton>
          ) : null}
        </Toolbar>
      </AppBar>
      {signedIn ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          <Toolbar />
          <List>
            {session.role === 'SUPER_ADMIN' ? (
              <ListItemButton component={Link} to="/admins">
                <ListItemText primary="Сотрудники" />
              </ListItemButton>
            ) : null}
          </List>
        </Drawer>
      ) : null}
      <Menu
        anchorEl={accountAnchor}
        open={accountAnchor !== null}
        onClose={() => {
          setAccountAnchor(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography>{session.email}</Typography>
          <Typography variant="body2" color="text.secondary">
            {session.id}
          </Typography>
        </Box>
        <MenuItem
          component={Link}
          to="/password"
          onClick={() => {
            setAccountAnchor(null);
          }}
        >
          Смена пароля
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            void session.logout();
          }}
        >
          Выход
        </MenuItem>
      </Menu>
      <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
        <Toolbar />
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
