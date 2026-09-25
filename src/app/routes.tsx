import type { RouteObject } from 'react-router';
import { AdminsPage } from './AdminsPage.tsx';
import { AppShell } from './AppShell.tsx';
import { ChangePasswordPage } from './ChangePasswordPage.tsx';
import { CompositionsPage } from './CompositionsPage.tsx';
import { HomePage, LoginRedirect, MissingPage } from './pages.tsx';
import { TagsPage } from './TagsPage.tsx';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginRedirect /> },
      { path: '/', element: <HomePage /> },
      { path: '/compositions', element: <CompositionsPage /> },
      { path: '/tags', element: <TagsPage /> },
      { path: '/admins', element: <AdminsPage /> },
      { path: '/password', element: <ChangePasswordPage /> },
      { path: '*', element: <MissingPage /> },
    ],
  },
];
