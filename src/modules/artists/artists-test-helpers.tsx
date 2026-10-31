import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, vi } from 'vitest';
import { AppProviders } from '../../app/App.tsx';
import { routes } from '../../app/routes.tsx';
import type { SessionStorage } from '../session/session-store.ts';
import { RootStore } from '../../shared/store/root-store.ts';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';

export const sampleArtist = (
  overrides: {
    id?: string;
    name?: string;
    createdAt?: string;
  } = {},
) => {
  return {
    id: overrides.id ?? 'artist-id',
    name: overrides.name ?? 'Queen',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  };
};

export const renderArtists = ({
  role = 'ADMIN',
}: {
  role?: 'ADMIN' | 'SUPER_ADMIN';
} = {}) => {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role, type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, {
    initialEntries: ['/artists'],
  });
  const view = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, store };
};

export const openCreateDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
};

export const submitCreateDialog = () => {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
};

export const openEditDialog = (name: string) => {
  const row = screen.getByText(name).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Изменить' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
};

export const submitEditDialog = () => {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
};

export const openDeleteDialog = (name: string) => {
  const row = screen.getByText(name).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Удалить' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
};

export const confirmDeleteDialog = () => {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
};

export const getArtistsListCalls = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return method === 'GET' && new URL(url).pathname === '/artists';
  });
};

export const postBodies = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return JSON.parse(typeof body === 'string' ? body : '') as Record<
        string,
        unknown
      >;
    });
};

export const patchBodies = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((call) => {
      const init = call[1] as RequestInit;
      const body = init.body;
      return [
        call[0],
        JSON.parse(typeof body === 'string' ? body : '') as Record<
          string,
          unknown
        >,
      ] as const;
    });
};

export const deleteCalls = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls.filter(
    (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
  );
};

export const stubFetch = (
  createResponse: () => Response,
): ReturnType<typeof vi.fn> => {
  const fetchMock = vi
    .fn()
    .mockImplementation(() => Promise.resolve(createResponse()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

export const jsonResponse = (status: number, body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const createMemoryStorage = (
  initial: Record<string, string> = {},
): SessionStorage => {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
  };
};
