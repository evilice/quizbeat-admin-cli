import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmDeleteDialog,
  deleteCalls,
  getCompositionListCalls,
  jsonResponse,
  openDeleteDialog,
  renderCompositions,
  sampleComposition,
  sampleTag,
  stubFetch,
  stubListFetch,
} from '../compositions-test-helpers.tsx';

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
        fetchMock.mock.calls.some((call) => String(call[0]).includes('/tags')),
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

describe('ошибка списка без текста', () => {
  it('пустой ответ 500 показывает общую заглушку, а не пустую страницу', async () => {
    stubFetch((url: string) => {
      if (new URL(String(url)).pathname.endsWith('/tags')) {
        return jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 });
      }
      return new Response('', { status: 500 });
    });
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Непредвиденная ошибка')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('удаление композиции', () => {
  const COMPOSITION_ID = '550e8400-e29b-41d4-a716-446655440010';
  const COMPOSITION = sampleComposition({
    id: COMPOSITION_ID,
    title: 'Song One',
    author: 'Author One',
  });

  it('ошибка удаления показывается один раз, в диалоге, и сбрасывается отменой', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(new Response('', { status: 500 }));
        }
        if (new URL(String(url)).pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [COMPOSITION],
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

    openDeleteDialog('Song One');
    confirmDeleteDialog();
    await waitFor(() => {
      expect(screen.getAllByText('Непредвиденная ошибка')).toHaveLength(1);
    });
    expect(
      within(screen.getByRole('dialog')).getByText('Непредвиденная ошибка'),
    ).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Отмена',
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.queryByText('Непредвиденная ошибка')).toBeNull();

    openDeleteDialog('Song One');
    expect(screen.queryByText('Непредвиденная ошибка')).toBeNull();
  });

  it('отмена не вызывает fetch, строка остаётся', async () => {
    const fetchMock = stubListFetch({
      items: [COMPOSITION],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsAfterLoad = fetchMock.mock.calls.length;

    openDeleteDialog('Song One');
    expect(
      within(screen.getByRole('dialog')).getByText(/Author One/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
    expect(deleteCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByText('Song One')).toBeTruthy();
  });

  it('согласие шлёт DELETE на путь с uuid этой строки и не шлёт PATCH', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(200, {
              ...COMPOSITION,
              deletedAt: '2026-09-25T12:00:00.000Z',
            }),
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
            items: [COMPOSITION],
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

    openDeleteDialog('Song One');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(deleteCalls(fetchMock)).toHaveLength(1);
    });

    const [url, init] = deleteCalls(fetchMock)[0]!;
    expect(new URL(String(url)).pathname).toBe(
      `/compositions/${COMPOSITION_ID}`,
    );
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
    expect(
      fetchMock.mock.calls.filter(
        (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH',
      ),
    ).toHaveLength(0);
  });

  it('ответ 200 с deletedAt убирает подтверждение и вызывает повторное чтение списка', async () => {
    let listCount = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(200, {
              ...COMPOSITION,
              deletedAt: '2026-09-25T12:00:00.000Z',
            }),
          );
        }
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
          );
        }
        listCount += 1;
        if (listCount === 1) {
          return Promise.resolve(
            jsonResponse(200, {
              items: [COMPOSITION],
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
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);

    openDeleteDialog('Song One');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getCompositionListCalls(fetchMock)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.queryByText('Song One')).toBeNull();
    });
  });

  it('до ответа сервера строка в таблице на месте', async () => {
    let resolveDelete!: (value: Response) => void;
    const deletePromise = new Promise<Response>((resolve) => {
      resolveDelete = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return deletePromise;
        }
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [COMPOSITION],
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

    openDeleteDialog('Song One');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(deleteCalls(fetchMock)).toHaveLength(1);
    });
    expect(screen.getByText('Song One')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    resolveDelete(
      jsonResponse(200, {
        ...COMPOSITION,
        deletedAt: '2026-09-25T12:00:00.000Z',
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('404 показывает message и запрашивает список заново', async () => {
    const notFoundMessage = 'Not Found';
    let listCount = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(404, {
              statusCode: 404,
              message: notFoundMessage,
              error: 'Not Found',
              path: `/compositions/${COMPOSITION_ID}`,
              timestamp: '2026-09-25T00:00:00.000Z',
            }),
          );
        }
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
          );
        }
        listCount += 1;
        if (listCount === 1) {
          return Promise.resolve(
            jsonResponse(200, {
              items: [COMPOSITION],
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
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);

    openDeleteDialog('Song One');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(screen.getByText(notFoundMessage)).toBeTruthy();
    });
    await waitFor(() => {
      expect(getCompositionListCalls(fetchMock)).toHaveLength(2);
    });
  });
});
