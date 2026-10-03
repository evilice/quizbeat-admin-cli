import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  SvgIcon,
  Toolbar,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { Link, Outlet } from 'react-router';
import { LoginPage } from '../modules/session/LoginPage.tsx';
import { useAppShell } from './use-app-shell.ts';
import { PagesMenu } from './components/PagesMenu.tsx';

const drawerWidth = 240;

export const AppShell = observer(function AppShell() {
  const {
    pathname,
    signedIn,
    accountAnchor,
    session,
    restorePending,
    restoreMessages,
    setAccountAnchor,
  } = useAppShell();

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
          <PagesMenu session={session} pathname={pathname} />
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
          <Typography>
            <b>{session.email}</b>
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
