import type { RouteObject } from 'react-router';
import { AppShell, HomePage, MissingPage } from './AppShell.tsx';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '*', element: <MissingPage /> },
    ],
  },
];
