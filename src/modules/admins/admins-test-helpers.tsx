import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, vi } from 'vitest';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';
import { RootStore } from '../../shared/store/root-store.ts';
import type { SessionStorage } from '../session/session-store.ts';
import { AppProviders } from '../../app/App.tsx';
import { routes } from '../../app/routes.tsx';

export function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
}

export function submitCreateDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
}

export function openResetPasswordDialog(email: string) {
  const row = screen.getByText(email).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Сбросить пароль' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
}

export function submitResetPasswordDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Сбросить пароль' }),
  );
}

export function passwordPatchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method;
    return method === 'PATCH' && url.includes('/password');
  });
}

export function getListCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return url.includes('/admins') && method === 'GET';
  });
}

export function mutationCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return method !== 'GET';
  });
}

export function deleteCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
  );
}

export function postBodies(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return typeof body === 'string' ? (JSON.parse(body) as unknown) : body;
    });
}

export function patchBodies(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return typeof body === 'string' ? (JSON.parse(body) as unknown) : body;
    });
}

export function renderAdmins({
  role = 'SUPER_ADMIN',
}: {
  role?: 'ADMIN' | 'SUPER_ADMIN';
} = {}) {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role, type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, { initialEntries: ['/admins'] });
  const view = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, store };
}

export function sampleAdmin(
  overrides: {
    id?: string;
    email?: string;
    role?: 'ADMIN' | 'SUPER_ADMIN';
    isActive?: boolean;
  } = {},
) {
  return {
    id: overrides.id ?? 'admin-id',
    email: overrides.email ?? 'a@example.com',
    role: overrides.role ?? 'ADMIN',
    isActive: overrides.isActive ?? true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
