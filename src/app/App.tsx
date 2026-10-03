import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { RootStore } from '../shared/store/root-store.ts';
import { RootStoreProvider } from '../shared/store/root-store-context.tsx';
import { theme } from './theme.ts';

export function AppProviders({
  store,
  children,
}: {
  store: RootStore;
  children: ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <RootStoreProvider store={store}>{children}</RootStoreProvider>
    </ThemeProvider>
  );
}
