import { Typography } from '@mui/material';
import { Navigate } from 'react-router';

export function HomePage() {
  return <Typography>Рабочие экраны появятся на следующих этапах.</Typography>;
}

export function MissingPage() {
  return <Typography>Такого адреса нет.</Typography>;
}

export function LoginRedirect() {
  return <Navigate to="/" replace />;
}
