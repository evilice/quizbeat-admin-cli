import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getListCalls,
  jsonResponse,
  renderTags,
  sampleTag,
  stubFetch,
} from '../tags-test-helpers.tsx';

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

  it('ошибка без текста загрузки показывает общую заглушку', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('Непредвиденная ошибка')).toBeTruthy();
    });
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
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
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
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
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
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
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
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
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
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

  it('ошибка без текста удаления показывает общую заглушку, диалог остаётся', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(new Response('', { status: 500 }));
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
      expect(
        within(screen.getByRole('dialog')).getByText('Непредвиденная ошибка'),
      ).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(getListCalls(fetchMock)).toHaveLength(1);
  });
});

const openDeleteDialog = (code: string) => {
  const row = screen.getByText(code).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Удалить' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
};

const confirmDeleteDialog = () => {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
};

const stubListWithTag = (tag: ReturnType<typeof sampleTag>) => {
  return stubFetch(() =>
    jsonResponse(200, {
      items: [tag],
      total: 1,
      page: 1,
      limit: 20,
    }),
  );
};

const deleteCalls = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls.filter(
    (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
  );
};
