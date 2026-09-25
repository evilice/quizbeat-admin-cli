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

describe('экран списка композиций', () => {
  it('первая загрузка без поиска, статуса и тегов не содержит search, status, tagIds', async () => {
    const fetchMock = stubListFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });

    const compositionCalls = getCompositionListCalls(fetchMock);
    expect(compositionCalls.length).toBeGreaterThanOrEqual(1);
    const firstUrl = new URL(String(compositionCalls[0]?.[0]));
    expect(firstUrl.pathname).toBe('/compositions');
    expect(firstUrl.searchParams.has('search')).toBe(false);
    expect(firstUrl.searchParams.has('status')).toBe(false);
    expect(firstUrl.searchParams.has('tagIds')).toBe(false);
  });

  it('выбор двух тегов даёт один tagIds через запятую и сбрасывает страницу на 1', async () => {
    const tagA = sampleTag({
      id: 'tag-a',
      code: 'rock',
      translations: [
        { locale: 'ru', name: 'Рок' },
        { locale: 'en', name: 'Rock' },
      ],
    });
    const tagB = sampleTag({
      id: 'tag-b',
      code: 'jazz',
      translations: [
        { locale: 'ru', name: 'Джаз' },
        { locale: 'en', name: 'Jazz' },
      ],
    });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [tagA, tagB],
            total: 2,
            page: 1,
            limit: 100,
          }),
        );
      }
      if (!parsed.pathname.endsWith('/compositions')) {
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      }
      const page = Number(parsed.searchParams.get('page') ?? '1');
      const tagIds = parsed.searchParams.get('tagIds');
      if (tagIds === 'tag-a,tag-b' || tagIds === 'tag-b,tag-a') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              sampleComposition({
                id: 'filtered-1',
                title: 'Filtered Song',
                tags: [tagA, tagB],
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
            sampleComposition({
              id: `page-${page}`,
              title: `Page ${page}`,
            }),
          ],
          total: 40,
          page,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes('/tags'),
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    await waitFor(() => {
      expect(screen.getByText('Page 2')).toBeTruthy();
    });
    expect(
      new URL(
        String(getCompositionListCalls(fetchMock).at(-1)?.[0]),
      ).searchParams.get('page'),
    ).toBe('2');

    fireEvent.mouseDown(screen.getByLabelText('Теги'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Рок' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Рок' }));
    fireEvent.click(screen.getByRole('option', { name: 'Джаз' }));

    await waitFor(() => {
      expect(screen.getByText('Filtered Song')).toBeTruthy();
    });

    const lastUrl = new URL(
      String(getCompositionListCalls(fetchMock).at(-1)?.[0]),
    );
    const tagIdsParam = lastUrl.searchParams.get('tagIds');
    expect(lastUrl.searchParams.getAll('tagIds')).toHaveLength(1);
    expect(tagIdsParam?.split(',').sort()).toEqual(['tag-a', 'tag-b']);
    expect(lastUrl.searchParams.get('page')).toBe('1');
  });

  it('выбор статуса DRAFT даёт status=DRAFT; «все» параметра status не содержит', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [],
            total: 0,
            page: 1,
            limit: 100,
          }),
        );
      }
      if (!parsed.pathname.endsWith('/compositions')) {
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      }
      if (parsed.searchParams.get('status') === 'DRAFT') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              sampleComposition({
                id: 'draft-1',
                title: 'Draft Song',
                status: 'DRAFT',
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
          items: [sampleComposition({ title: 'Any Song' })],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Any Song')).toBeTruthy();
    });
    expect(
      new URL(
        String(getCompositionListCalls(fetchMock)[0]?.[0]),
      ).searchParams.has('status'),
    ).toBe(false);

    fireEvent.mouseDown(screen.getByLabelText('Статус'));
    fireEvent.click(screen.getByRole('option', { name: 'Черновик' }));

    await waitFor(() => {
      expect(screen.getByText('Draft Song')).toBeTruthy();
    });
    expect(
      new URL(
        String(getCompositionListCalls(fetchMock).at(-1)?.[0]),
      ).searchParams.get('status'),
    ).toBe('DRAFT');

    fireEvent.mouseDown(screen.getByLabelText('Статус'));
    fireEvent.click(screen.getByRole('option', { name: 'Все' }));

    await waitFor(() => {
      expect(screen.getByText('Any Song')).toBeTruthy();
    });
    expect(
      new URL(
        String(getCompositionListCalls(fetchMock).at(-1)?.[0]),
      ).searchParams.has('status'),
    ).toBe(false);
  });

  it('ввод поиска даёт параметр search и сбрасывает страницу на 1', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [],
            total: 0,
            page: 1,
            limit: 100,
          }),
        );
      }
      if (!parsed.pathname.endsWith('/compositions')) {
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      }
      const page = Number(parsed.searchParams.get('page') ?? '1');
      const search = parsed.searchParams.get('search');
      if (search === 'beatles') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              sampleComposition({
                id: 'search-1',
                title: 'Beatles Hit',
                author: 'Lennon',
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
            sampleComposition({
              id: `page-${page}`,
              title: `Page ${page}`,
            }),
          ],
          total: 40,
          page,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    await waitFor(() => {
      expect(screen.getByText('Page 2')).toBeTruthy();
    });
    expect(
      new URL(
        String(getCompositionListCalls(fetchMock).at(-1)?.[0]),
      ).searchParams.get('page'),
    ).toBe('2');

    fireEvent.change(screen.getByLabelText('Поиск по названию или автору'), {
      target: { value: 'beatles' },
    });

    await waitFor(() => {
      expect(screen.getByText('Beatles Hit')).toBeTruthy();
    });

    const lastUrl = new URL(
      String(getCompositionListCalls(fetchMock).at(-1)?.[0]),
    );
    expect(lastUrl.searchParams.get('search')).toBe('beatles');
    expect(lastUrl.searchParams.get('page')).toBe('1');
  });

  it('строка с тегом, у которого сначала en, показывает русское название в чипе', async () => {
    stubListFetch({
      items: [
        sampleComposition({
          id: 'c-1',
          title: 'Folk Song',
          author: 'Anon',
          status: 'PUBLISHED',
          tags: [
            sampleTag({
              id: 't-order',
              code: 'folk',
              translations: [
                { locale: 'en', name: 'Folk' },
                { locale: 'ru', name: 'Фолк' },
              ],
            }),
          ],
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Folk Song')).toBeTruthy();
    });

    const row = screen.getByText('Folk Song').closest('tr');
    expect(row).toBeTruthy();
    expect(row!.textContent).toContain('Anon');
    expect(row!.textContent).toContain('Опубликована');
    const chip = row!.querySelector('.MuiChip-label');
    expect(chip?.textContent).toBe('Фолк');
  });

  it('пустой 200 и ответ с ошибкой различаются', async () => {
    const emptyFetch = stubListFetch({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    const { unmount } = renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
    expect(getCompositionListCalls(emptyFetch)).toHaveLength(1);
    unmount();
    cleanup();
    vi.unstubAllGlobals();

    const errorMessage = 'Something went wrong';
    stubFetch((url: string) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return jsonResponse(200, {
          items: [],
          total: 0,
          page: 1,
          limit: 100,
        });
      }
      return jsonResponse(500, {
        statusCode: 500,
        message: errorMessage,
        error: 'Internal Server Error',
        path: '/compositions',
        timestamp: '2026-09-25T00:00:00.000Z',
      });
    });
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeTruthy();
    });
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('создание композиции', () => {
  it('пустое название при заполненном авторе не вызывает fetch', async () => {
    const fetchMock = stubListFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите название')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('пустой автор при заполненном названии не вызывает fetch', async () => {
    const fetchMock = stubListFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(
      within(screen.getByRole('dialog')).getByLabelText('Название'),
      { target: { value: 'New Song' } },
    );
    submitCreateDialog();

    expect(screen.getByText('Укажите автора')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('создание без смены статуса не содержит ключ status; без тегов — без tagIds', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(201, sampleComposition({ id: 'created-1', title: 'New' })),
        );
      }
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(
          jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleComposition()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'New Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'New Author' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0];
    expect(body).toEqual({ title: 'New Song', author: 'New Author' });
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('tagIds');
  });

  it('создание с выбором «Опубликована» шлёт status PUBLISHED; с двумя тегами — массив uuid', async () => {
    const tagA = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440001',
      code: 'rock',
      translations: [
        { locale: 'ru', name: 'Рок' },
        { locale: 'en', name: 'Rock' },
      ],
    });
    const tagB = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440002',
      code: 'jazz',
      translations: [
        { locale: 'ru', name: 'Джаз' },
        { locale: 'en', name: 'Jazz' },
      ],
    });
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            201,
            sampleComposition({
              id: 'created-1',
              title: 'Published',
              status: 'PUBLISHED',
              tags: [tagA, tagB],
            }),
          ),
        );
      }
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [tagA, tagB],
            total: 2,
            page: 1,
            limit: 100,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleComposition()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes('/tags')),
      ).toBe(true);
    });

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'Published Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    fireEvent.mouseDown(within(dialog).getByLabelText('Статус'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Опубликована' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Опубликована' }));

    fireEvent.mouseDown(within(dialog).getByLabelText('Теги'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Рок' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Рок' }));
    fireEvent.click(screen.getByRole('option', { name: 'Джаз' }));
    // close the multi-select menu so submit is reachable
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0];
    expect(body).toEqual({
      title: 'Published Song',
      author: 'Author',
      status: 'PUBLISHED',
      tagIds: [tagA.id, tagB.id],
    });
    expect(Array.isArray(body.tagIds)).toBe(true);
    expect(typeof body.tagIds).not.toBe('string');
  });

  it('201 закрывает диалог и вызывает повторное чтение списка', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(201, sampleComposition({ id: 'created-1', title: 'New' })),
        );
      }
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(
          jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleComposition()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'New Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getCompositionListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('400 с текстом про неизвестный тег показывает строку и не запрашивает список заново', async () => {
    const unknownTagMessage =
      'One or more tagIds do not reference an existing tag';
    const tagA = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440099',
      code: 'ghost',
      translations: [
        { locale: 'ru', name: 'Призрак' },
        { locale: 'en', name: 'Ghost' },
      ],
    });
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(400, {
            statusCode: 400,
            message: unknownTagMessage,
            error: 'Bad Request',
            path: '/compositions',
            timestamp: '2026-09-25T00:00:00.000Z',
          }),
        );
      }
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tags')) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [tagA],
            total: 1,
            page: 1,
            limit: 100,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleComposition()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    fireEvent.mouseDown(within(dialog).getByLabelText('Теги'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Призрак' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Призрак' }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByText(unknownTagMessage)).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);
  });
});

function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
}

function submitCreateDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
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

function getCompositionListCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return url.includes('/compositions') && method === 'GET';
  });
}

function renderCompositions({
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

function sampleComposition(overrides: {
  id?: string;
  title?: string;
  author?: string;
  status?: 'DRAFT' | 'PUBLISHED';
  tags?: ReturnType<typeof sampleTag>[];
} = {}) {
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

function stubListFetch(
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

function stubFetch(
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
