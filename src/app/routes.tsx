import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell.tsx';
import {
  AdminsPage,
  HomePage,
  LoginRedirect,
  MissingPage,
} from './pages.tsx';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginRedirect /> },
      { path: '/', element: <HomePage /> },
      { path: '/admins', element: <AdminsPage /> },
      { path: '*', element: <MissingPage /> },
    ],
  },
];
