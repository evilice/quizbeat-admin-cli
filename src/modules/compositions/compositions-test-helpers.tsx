import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, vi } from 'vitest';
import { AppProviders } from '../../app/App.tsx';
import { routes } from '../../app/routes.tsx';
import type { SessionStorage } from '../session/session-store.ts';
import { RootStore } from '../../shared/store/root-store.ts';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';

export function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
}

export function submitCreateDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
}

export function openDeleteDialog(title: string) {
  const row = screen.getByText(title).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Удалить' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
}

export function confirmDeleteDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
}

export function deleteCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
  );
}

export function postBodies(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return JSON.parse(typeof body === 'string' ? body : '') as Record<
        string,
        unknown
      >;
    });
}

export function getCompositionListCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return url.includes('/compositions') && method === 'GET';
  });
}

export function renderCompositions({
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
  const router = createMemoryRouter(routes, {
    initialEntries: ['/compositions'],
  });
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

export function sampleComposition(
  overrides: {
    id?: string;
    title?: string;
    author?: string;
    status?: 'DRAFT' | 'PUBLISHED';
    tags?: ReturnType<typeof sampleTag>[];
  } = {},
) {
  return {
    id: overrides.id ?? 'comp-1',
    title: overrides.title ?? 'Song One',
    author: overrides.author ?? 'Author',
    status: overrides.status ?? 'DRAFT',
    createdById: 'admin-1',
    tags: overrides.tags ?? [],
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function stubListFetch(
  page: {
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  } = {
    items: [sampleComposition()],
    total: 1,
    page: 1,
    limit: 20,
  },
) {
  return stubFetch((url: string) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith('/tags')) {
      return jsonResponse(200, {
        items: [],
        total: 0,
        page: 1,
        limit: 100,
      });
    }
    return jsonResponse(200, page);
  });
}

export function stubFetch(
  createResponse: (url: string) => Response,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(createResponse(String(url))),
    );
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
