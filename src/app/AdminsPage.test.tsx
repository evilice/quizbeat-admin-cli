import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeAccessToken } from '../stores/make-access-token.ts';
import { RootStore } from '../stores/root-store.ts';
import type { SessionStorage } from '../stores/session-store.ts';
import { AppProviders } from './App.tsx';
import { routes } from './routes.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('экран списка сотрудников', () => {
  it('первая загрузка без isActive, строка с isActive false видна', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        items: [
          sampleAdmin({
            id: 'a-1',
            email: 'alive@example.com',
            role: 'ADMIN',
            isActive: true,
          }),
          sampleAdmin({
            id: 'a-2',
            email: 'gone@example.com',
            role: 'SUPER_ADMIN',
            isActive: false,
          }),
        ],
        total: 2,
        page: 1,
        limit: 20,
      }),
    );
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('gone@example.com')).toBeTruthy();
    });

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.pathname).toBe('/admins');
    expect(firstUrl.searchParams.has('isActive')).toBe(false);
    expect(screen.getByText('неактивен')).toBeTruthy();
    expect(screen.getByText('Супер-админ')).toBeTruthy();
    expect(screen.getByText('alive@example.com')).toBeTruthy();
    expect(screen.getByText('активен')).toBeTruthy();
    expect(screen.getByText('Админ')).toBeTruthy();
  });

  it('выбор «только неактивные» даёт isActive=false и сбрасывает страницу на 1', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (!parsed.pathname.endsWith('/admins')) {
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      }
      const page = Number(parsed.searchParams.get('page') ?? '1');
      if (parsed.searchParams.get('isActive') === 'false') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              sampleAdmin({
                id: 'inactive-1',
                email: 'off@example.com',
                isActive: false,
              }),
            ],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [
            sampleAdmin({
              id: `page-${page}`,
              email: `page${page}@example.com`,
              isActive: true,
            }),
          ],
          total: 40,
          page,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('page1@example.com')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    await waitFor(() => {
      expect(screen.getByText('page2@example.com')).toBeTruthy();
    });
    expect(
      new URL(String(fetchMock.mock.calls.at(-1)?.[0])).searchParams.get(
        'page',
      ),
    ).toBe('2');

    fireEvent.mouseDown(screen.getByLabelText('Активность'));
    fireEvent.click(screen.getByRole('option', { name: 'Только неактивные' }));

    await waitFor(() => {
      expect(screen.getByText('off@example.com')).toBeTruthy();
    });

    const lastUrl = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
    expect(lastUrl.searchParams.get('isActive')).toBe('false');
    expect(lastUrl.searchParams.get('page')).toBe('1');
  });

  it('пустой 200 и 403 различаются', async () => {
    const emptyFetch = stubFetch(() =>
      jsonResponse(200, {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
    );
    const { unmount } = renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('Никого не найдено')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
    expect(emptyFetch).toHaveBeenCalledTimes(1);
    unmount();
    cleanup();
    vi.unstubAllGlobals();

    const forbidMessage = 'Forbidden resource';
    stubFetch(() =>
      jsonResponse(403, {
        statusCode: 403,
        message: forbidMessage,
        error: 'Forbidden',
        path: '/admins',
        timestamp: '2026-09-24T00:00:00.000Z',
      }),
    );
    renderAdmins({ role: 'ADMIN' });

    await waitFor(() => {
      expect(screen.getByText(forbidMessage)).toBeTruthy();
    });
    expect(screen.queryByText('Никого не найдено')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

function renderAdmins({
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
  return render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

function sampleAdmin(overrides: {
  id?: string;
  email?: string;
  role?: 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
} = {}) {
  return {
    id: overrides.id ?? 'admin-id',
    email: overrides.email ?? 'a@example.com',
    role: overrides.role ?? 'ADMIN',
    isActive: overrides.isActive ?? true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function stubFetch(createResponse: () => Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockImplementation(() => Promise.resolve(createResponse()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createMemoryStorage(
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
