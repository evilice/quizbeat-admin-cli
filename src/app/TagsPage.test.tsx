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

describe('экран списка тегов', () => {
  it('первая загрузка без поиска не содержит search', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        items: [
          sampleTag({
            id: 't-1',
            code: 'rock',
            translations: [
              { locale: 'ru', name: 'Рок' },
              { locale: 'en', name: 'Rock' },
            ],
          }),
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.pathname).toBe('/tags');
    expect(firstUrl.searchParams.has('search')).toBe(false);
  });

  it('ввод поиска даёт search и сбрасывает страницу на 1', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (!parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      }
      const page = Number(parsed.searchParams.get('page') ?? '1');
      const search = parsed.searchParams.get('search');
      if (search === 'jazz') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              sampleTag({
                id: 'jazz-1',
                code: 'jazz',
                translations: [
                  { locale: 'ru', name: 'Джаз' },
                  { locale: 'en', name: 'Jazz' },
                ],
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
            sampleTag({
              id: `page-${page}`,
              code: `code-${page}`,
              translations: [
                { locale: 'ru', name: `Страница ${page}` },
                { locale: 'en', name: `Page ${page}` },
              ],
            }),
          ],
          total: 40,
          page,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTags();

    await waitFor(() => {
      expect(screen.getByText('code-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    await waitFor(() => {
      expect(screen.getByText('code-2')).toBeTruthy();
    });
    expect(
      new URL(String(fetchMock.mock.calls.at(-1)?.[0])).searchParams.get(
        'page',
      ),
    ).toBe('2');

    fireEvent.change(screen.getByLabelText('Поиск по названию'), {
      target: { value: 'jazz' },
    });

    await waitFor(() => {
      expect(screen.getByText('jazz')).toBeTruthy();
    });

    const lastUrl = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
    expect(lastUrl.searchParams.get('search')).toBe('jazz');
    expect(lastUrl.searchParams.get('page')).toBe('1');
  });

  it('тег с translations сначала en показывает ru и en по locale', async () => {
    stubFetch(() =>
      jsonResponse(200, {
        items: [
          sampleTag({
            id: 't-order',
            code: 'folk',
            translations: [
              { locale: 'en', name: 'Folk' },
              { locale: 'ru', name: 'Фолк' },
            ],
          }),
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('folk')).toBeTruthy();
    });

    const row = screen.getByText('folk').closest('tr');
    expect(row).toBeTruthy();
    const cells = row!.querySelectorAll('td');
    expect(cells[0]?.textContent).toBe('folk');
    expect(cells[1]?.textContent).toBe('Фолк');
    expect(cells[2]?.textContent).toBe('Folk');
  });

  it('пустой 200 и ответ с ошибкой различаются', async () => {
    const emptyFetch = stubFetch(() =>
      jsonResponse(200, {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
    );
    const { unmount } = renderTags();

    await waitFor(() => {
      expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
    expect(emptyFetch).toHaveBeenCalledTimes(1);
    unmount();
    cleanup();
    vi.unstubAllGlobals();

    const errorMessage = 'Something went wrong';
    stubFetch(() =>
      jsonResponse(500, {
        statusCode: 500,
        message: errorMessage,
        error: 'Internal Server Error',
        path: '/tags',
        timestamp: '2026-09-24T00:00:00.000Z',
      }),
    );
    renderTags();

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeTruthy();
    });
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

function renderTags({
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

function sampleTag(overrides: {
  id?: string;
  code?: string;
  translations?: { locale: 'ru' | 'en'; name: string }[];
} = {}) {
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
