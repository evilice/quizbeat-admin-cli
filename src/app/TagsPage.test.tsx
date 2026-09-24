import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

describe('создание и правка тега', () => {
  it('пустое en при заполненных коде и ru не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите название (en)')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('пустое ru при заполненных коде и en не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите название (ru)')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('пустой код при заполненных названиях не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите код')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('создание шлёт две локали с полем name и не шлёт text', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            201,
            sampleTag({
              id: 'created-1',
              code: 'jazz',
              translations: [
                { locale: 'ru', name: 'Джаз' },
                { locale: 'en', name: 'Jazz' },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleTag()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0]!;
    expect(body).toEqual({
      code: 'jazz',
      translations: [
        { locale: 'ru', name: 'Джаз' },
        { locale: 'en', name: 'Jazz' },
      ],
    });
    expect(body).not.toHaveProperty('text');
    expect(
      (body.translations as { text?: unknown }[]).every(
        (item) => !Object.hasOwn(item, 'text'),
      ),
    ).toBe(true);
  });

  it('правка с изменённым только ru шлёт и ru, и en', async () => {
    const existing = sampleTag({
      id: 'tag-1',
      code: 'rock',
      translations: [
        { locale: 'en', name: 'Rock' },
        { locale: 'ru', name: 'Рок' },
      ],
    });
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve(
          jsonResponse(200, {
            ...existing,
            translations: [
              { locale: 'ru', name: 'Рок-н-ролл' },
              { locale: 'en', name: 'Rock' },
            ],
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [existing],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    openEditDialog('rock');
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Рок-н-ролл' },
    });
    submitEditDialog();

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });

    const [url, body] = patchBodies(fetchMock)[0]!;
    expect(new URL(String(url)).pathname).toBe(`/tags/${existing.id}`);
    expect(body).toEqual({
      code: 'rock',
      translations: [
        { locale: 'ru', name: 'Рок-н-ролл' },
        { locale: 'en', name: 'Rock' },
      ],
    });
  });

  it('201 закрывает диалог и вызывает повторное чтение списка', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            201,
            sampleTag({
              id: 'created-1',
              code: 'jazz',
              translations: [
                { locale: 'ru', name: 'Джаз' },
                { locale: 'en', name: 'Jazz' },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleTag()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('409 с текстом про занятый код показывает строку и не запрашивает список заново', async () => {
    const conflictMessage = 'Tag with this code already exists';
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(409, {
            statusCode: 409,
            message: conflictMessage,
            error: 'Conflict',
            path: '/tags',
            timestamp: '2026-09-24T00:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleTag()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'rock' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Рок' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Rock' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.getByText(conflictMessage)).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Код')).toHaveProperty('value', 'rock');
    expect(screen.getByLabelText('Название (ru)')).toHaveProperty(
      'value',
      'Рок',
    );
    expect(screen.getByLabelText('Название (en)')).toHaveProperty(
      'value',
      'Rock',
    );
    expect(getListCalls(fetchMock)).toHaveLength(1);
  });
});

describe('удаление тега', () => {
  const TAG_ID = '550e8400-e29b-41d4-a716-446655440000';
  const TAG = sampleTag({
    id: TAG_ID,
    code: 'rock',
    translations: [
      { locale: 'ru', name: 'Рок' },
      { locale: 'en', name: 'Rock' },
    ],
  });

  it('отмена не вызывает fetch, строка остаётся', async () => {
    const fetchMock = stubListWithTag(TAG);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsAfterLoad = fetchMock.mock.calls.length;

    openDeleteDialog('rock');
    expect(screen.getByText('Рок')).toBeTruthy();
    expect(screen.getByText('Rock')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
    expect(deleteCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByText('rock')).toBeTruthy();
  });

  it('согласие шлёт DELETE на путь с uuid строки и не шлёт тело', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [TAG],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    openDeleteDialog('rock');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(deleteCalls(fetchMock)).toHaveLength(1);
    });

    const [url, init] = deleteCalls(fetchMock)[0]!;
    expect(new URL(String(url)).pathname).toBe(`/tags/${TAG_ID}`);
    expect(init?.body).toBeUndefined();
  });

  it('пустой 204 убирает подтверждение и вызывает повторное чтение списка', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [TAG],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openDeleteDialog('rock');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('до ответа сервера строка в таблице на месте', async () => {
    let resolveDelete!: (value: Response) => void;
    const deletePromise = new Promise<Response>((resolve) => {
      resolveDelete = resolve;
    });
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return deletePromise;
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [TAG],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    openDeleteDialog('rock');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(deleteCalls(fetchMock)).toHaveLength(1);
    });
    expect(screen.getByText('rock')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    resolveDelete(new Response(null, { status: 204 }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('404 показывает message и запрашивает список заново', async () => {
    const notFoundMessage = 'Tag not found';
    let listCount = 0;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(
          jsonResponse(404, {
            statusCode: 404,
            message: notFoundMessage,
            error: 'Not Found',
            path: `/tags/${TAG_ID}`,
            timestamp: '2026-09-24T00:00:00.000Z',
          }),
        );
      }
      listCount += 1;
      if (listCount === 1) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [TAG],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openDeleteDialog('rock');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(screen.getByText(notFoundMessage)).toBeTruthy();
    });
    await waitFor(() => {
      expect(getListCalls(fetchMock)).toHaveLength(2);
    });
  });
});

function openDeleteDialog(code: string) {
  const row = screen.getByText(code).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Удалить' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
}

function confirmDeleteDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
}

function stubListWithTag(tag: ReturnType<typeof sampleTag>) {
  return stubFetch(() =>
    jsonResponse(200, {
      items: [tag],
      total: 1,
      page: 1,
      limit: 20,
    }),
  );
}

function deleteCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
  );
}

function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
}

function submitCreateDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
}

function openEditDialog(code: string) {
  const row = screen.getByText(code).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Изменить' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
}

function submitEditDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
}

function stubListOnlyFetch() {
  return stubFetch(() =>
    jsonResponse(200, {
      items: [sampleTag()],
      total: 1,
      page: 1,
      limit: 20,
    }),
  );
}

function getListCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return url.includes('/tags') && method === 'GET';
  });
}

function postBodies(fetchMock: ReturnType<typeof vi.fn>) {
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

function patchBodies(fetchMock: ReturnType<typeof vi.fn>) {
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
}

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
