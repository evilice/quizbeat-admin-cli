import type { RouteObject } from 'react-router';
import { AdminsPage } from './AdminsPage.tsx';
import { AppShell } from './AppShell.tsx';
import { ChangePasswordPage } from './ChangePasswordPage.tsx';
import { HomePage, LoginRedirect, MissingPage } from './pages.tsx';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginRedirect /> },
      { path: '/', element: <HomePage /> },
      { path: '/admins', element: <AdminsPage /> },
      { path: '/password', element: <ChangePasswordPage /> },
      { path: '*', element: <MissingPage /> },
    ],
  },
];
