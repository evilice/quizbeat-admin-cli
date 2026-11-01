import { Typography } from '@mui/material';
import { Navigate } from 'react-router';

export function HomePage() {
  return <Navigate to="/compositions" replace />;
}

export function MissingPage() {
  return <Typography>Такого адреса нет.</Typography>;
}

export function LoginRedirect() {
  return <Navigate to="/" replace />;
}
