import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell.tsx';
import { HomePage, LoginRedirect, MissingPage } from './pages.tsx';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginRedirect /> },
      { path: '/', element: <HomePage /> },
      { path: '*', element: <MissingPage /> },
    ],
  },
];
