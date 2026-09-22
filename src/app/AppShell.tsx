import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router';

export function AppShell() {
  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography component="h1" variant="h6">
            Админка QuizBeat
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 2 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export function HomePage() {
  return <Typography>Рабочие экраны появятся на следующих этапах.</Typography>;
}

export function MissingPage() {
  return <Typography>Такого адреса нет.</Typography>;
}
