import type { RouteObject } from 'react-router';
import { AdminsPage } from '../modules/admins/AdminsPage.tsx';
import { AppShell } from './AppShell.tsx';
import { ChangePasswordPage } from '../modules/session/ChangePasswordPage.tsx';
import { CompositionCardPage } from '../modules/compositions/CompositionCardPage.tsx';
import { CompositionsPage } from '../modules/compositions/CompositionsPage.tsx';
import { HomePage, LoginRedirect, MissingPage } from './pages.tsx';
import { TagsPage } from '../modules/tags/TagsPage.tsx';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginRedirect /> },
      { path: '/', element: <HomePage /> },
      { path: '/compositions', element: <CompositionsPage /> },
      { path: '/compositions/:id', element: <CompositionCardPage /> },
      { path: '/tags', element: <TagsPage /> },
      { path: '/admins', element: <AdminsPage /> },
      { path: '/password', element: <ChangePasswordPage /> },
      { path: '*', element: <MissingPage /> },
    ],
  },
];
