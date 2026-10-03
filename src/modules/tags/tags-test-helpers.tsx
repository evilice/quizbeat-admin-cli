import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { AppProviders } from '../../app/App.tsx';
import { routes } from '../../app/routes.tsx';
import { RootStore } from '../../shared/store/root-store.ts';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';
import type { SessionStorage } from '../session/session-store.ts';

export function getListCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return url.includes('/tags') && method === 'GET';
  });
}

export function renderTags({
  role = 'ADMIN',
}: {
  role?: 'ADMIN' | 'SUPER_ADMIN';
} = {}) {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role, type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, { initialEntries: ['/tags'] });
  const view = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, store };
}

export function sampleTag(
  overrides: {
    id?: string;
    code?: string;
    translations?: { locale: 'ru' | 'en'; name: string }[];
  } = {},
) {
  return {
    id: overrides.id ?? 'tag-id',
    code: overrides.code ?? 'rock',
    translations: overrides.translations ?? [
      { locale: 'ru' as const, name: 'Рок' },
      { locale: 'en' as const, name: 'Rock' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

export function stubFetch(
  createResponse: () => Response,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockImplementation(() => Promise.resolve(createResponse()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createMemoryStorage(
  initial: Record<string, string> = {},
): SessionStorage {
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
}
