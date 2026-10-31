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
  getArtistsListCalls,
  jsonResponse,
  openDeleteDialog,
  renderArtists,
  sampleArtist,
  stubFetch,
} from '../artists-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('экран списка исполнителей', () => {
  it('первая загрузка без поиска идёт на /artists с page=1', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        items: [sampleArtist()],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.pathname).toBe('/artists');
    expect(firstUrl.searchParams.has('search')).toBe(false);
    expect(firstUrl.searchParams.get('page')).toBe('1');
    expect(firstUrl.searchParams.get('limit')).toBe('20');
    expect(screen.getByLabelText('Поиск по имени')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Создать' })).toBeTruthy();
  });

  it('поиск не уходит сразу, а уходит после паузы', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (parsed.searchParams.get('search') === 'jazz') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleArtist({ id: 'jazz-1', name: 'Jazz' })],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleArtist({ id: 'page-1', name: 'Page 1' })],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeTruthy();
    });
    const callsBefore = getArtistsListCalls(fetchMock).length;

    fireEvent.change(screen.getByLabelText('Поиск по имени'), {
      target: { value: 'jazz' },
    });

    expect(getArtistsListCalls(fetchMock)).toHaveLength(callsBefore);

    await waitFor(() => {
      expect(screen.getByText('Jazz')).toBeTruthy();
    });
    expect(
      new URL(
        String(getArtistsListCalls(fetchMock).at(-1)?.[0]),
      ).searchParams.get('search'),
    ).toBe('jazz');
  });

  it('пагинация шлёт page, поиск после паузы — search и сбрасывает страницу на 1', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (parsed.pathname !== '/artists') {
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      }
      const page = Number(parsed.searchParams.get('page') ?? '1');
      const search = parsed.searchParams.get('search');
      if (search === 'jazz') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleArtist({ id: 'jazz-1', name: 'Jazz' })],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleArtist({ id: `page-${page}`, name: `Page ${page}` })],
          total: 40,
          page,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    await waitFor(() => {
      expect(screen.getByText('Page 2')).toBeTruthy();
    });
    expect(
      new URL(
        String(getArtistsListCalls(fetchMock).at(-1)?.[0]),
      ).searchParams.get('page'),
    ).toBe('2');

    fireEvent.change(screen.getByLabelText('Поиск по имени'), {
      target: { value: 'jazz' },
    });

    await waitFor(() => {
      expect(screen.getByText('Jazz')).toBeTruthy();
    });

    const lastUrl = new URL(String(getArtistsListCalls(fetchMock).at(-1)?.[0]));
    expect(lastUrl.searchParams.get('search')).toBe('jazz');
    expect(lastUrl.searchParams.get('page')).toBe('1');
  });

  it('пустой 200 и ответ с ошибкой различаются', async () => {
    const emptyFetch = stubFetch(() =>
      jsonResponse(200, { items: [], total: 0, page: 1, limit: 20 }),
    );
    const { unmount } = renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
    expect(getArtistsListCalls(emptyFetch)).toHaveLength(1);
    unmount();
    cleanup();
    vi.unstubAllGlobals();

    const errorMessage = 'Something went wrong';
    stubFetch(() =>
      jsonResponse(500, {
        statusCode: 500,
        message: errorMessage,
        error: 'Internal Server Error',
        path: '/artists',
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    );
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeTruthy();
    });
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('таблица показывает только имя и действия', async () => {
    stubFetch(() =>
      jsonResponse(200, {
        items: [sampleArtist({ name: 'Earth, Wind & Fire' })],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Earth, Wind & Fire')).toBeTruthy();
    });

    const row = screen.getByText('Earth, Wind & Fire').closest('tr');
    expect(row).toBeTruthy();
    expect(row!.textContent).not.toContain('2026');
    expect(
      within(row as HTMLElement).getByRole('button', { name: 'Изменить' }),
    ).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('button', { name: 'Удалить' }),
    ).toBeTruthy();
  });
});

describe('удаление исполнителя', () => {
  const ARTIST_ID = '550e8400-e29b-41d4-a716-446655440020';
  const ARTIST = sampleArtist({ id: ARTIST_ID, name: 'Queen' });

  it('отмена не вызывает fetch, строка остаётся', async () => {
    const fetchMock = stubListWithArtist(ARTIST);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    const callsAfterLoad = fetchMock.mock.calls.length;

    openDeleteDialog('Queen');
    expect(screen.getByText('Имя: Queen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
    expect(deleteCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByText('Queen')).toBeTruthy();
  });

  it('согласие шлёт DELETE на путь с uuid и без тела', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [ARTIST],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });

    openDeleteDialog('Queen');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(deleteCalls(fetchMock)).toHaveLength(1);
    });

    const [url, init] = deleteCalls(fetchMock)[0]!;
    expect(new URL(String(url)).pathname).toBe(`/artists/${ARTIST_ID}`);
    expect(init?.body).toBeUndefined();
  });

  it('204 закрывает диалог и перечитывает список', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [ARTIST],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);

    openDeleteDialog('Queen');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getArtistsListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('409 с compositionCount показывает число, диалог не закрывается', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(409, {
              statusCode: 409,
              message: 'Artist is used by one or more compositions',
              error: 'Conflict',
              path: `/artists/${ARTIST_ID}`,
              timestamp: '2026-01-01T00:00:00.000Z',
              details: { compositionCount: 1 },
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [ARTIST],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });

    openDeleteDialog('Queen');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog')).getByText(
          'Исполнитель используется в композициях: 1. Удалить нельзя.',
        ),
      ).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);
  });

  it('409 без compositionCount показывает message сервера без NaN', async () => {
    const message = 'Artist is used by one or more compositions';
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(409, {
              statusCode: 409,
              message,
              error: 'Conflict',
              path: `/artists/${ARTIST_ID}`,
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [ARTIST],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });

    openDeleteDialog('Queen');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog')).getByText(message),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('404 закрывает диалог и молча перечитывает список', async () => {
    let listCount = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(404, {
              statusCode: 404,
              message: 'Not Found',
              error: 'Not Found',
              path: `/artists/${ARTIST_ID}`,
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
          );
        }
        listCount += 1;
        return Promise.resolve(
          jsonResponse(200, {
            items: listCount === 1 ? [ARTIST] : [],
            total: listCount === 1 ? 1 : 0,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);

    openDeleteDialog('Queen');
    confirmDeleteDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getArtistsListCalls(fetchMock)).toHaveLength(2);
    });
    expect(screen.queryByText('Not Found')).toBeNull();
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });
});

const stubListWithArtist = (artist: ReturnType<typeof sampleArtist>) => {
  return stubFetch(() =>
    jsonResponse(200, {
      items: [artist],
      total: 1,
      page: 1,
      limit: 20,
    }),
  );
};
