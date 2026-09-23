import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './app/App.tsx';
import { routes } from './app/routes.tsx';
import { RootStore } from './stores/root-store.ts';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Элемент #root не найден');
}

const rootStore = new RootStore(window.localStorage);
const router = createBrowserRouter(routes);

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders store={rootStore}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
