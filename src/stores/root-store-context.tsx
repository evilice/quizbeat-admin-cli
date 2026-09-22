import { createContext, useContext, type ReactNode } from 'react';
import type { RootStore } from './root-store.ts';

const RootStoreContext = createContext<RootStore | null>(null);

export function RootStoreProvider({
  store,
  children,
}: {
  store: RootStore;
  children: ReactNode;
}) {
  return (
    <RootStoreContext.Provider value={store}>
      {children}
    </RootStoreContext.Provider>
  );
}

export function useRootStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (store === null) {
    throw new Error('useRootStore вызван вне RootStoreProvider');
  }
  return store;
}
