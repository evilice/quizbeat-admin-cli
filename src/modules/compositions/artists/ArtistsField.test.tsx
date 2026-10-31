import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../../app/App.tsx';
import { makeAccessToken } from '../../../shared/testing/make-access-token.ts';
import { RootStore } from '../../../shared/store/root-store.ts';
import type { SessionStorage } from '../../session/session-store.ts';
import type { CompositionArtist } from '../../artists/artists-store.ts';
import { ArtistsField } from './ArtistsField.tsx';

const QUEEN = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Queen',
};
const ADAM = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Adam Lambert',
};
const AB = {
  id: '33333333-3333-3333-3333-333333333333',
  name: 'AB Artist',
};
const A = {
  id: '44444444-4444-4444-4444-444444444444',
  name: 'A Artist',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('поле «Исполнители»', () => {
  it('ввод шлёт search, page и limit после паузы и показывает серверную выдачу', async () => {
    const fetchMock = stubArtistsFetch(() => jsonResponse(200, page([QUEEN])));
    renderField();

    typeSearch('Que');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('option', { name: 'Queen' }, { timeout: 3000 }),
    ).toBeTruthy();

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/artists');
    expect(url.searchParams.get('search')).toBe('Que');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('устаревший ответ поиска не перетирает свежий', async () => {
    const pending = new Map<string, (response: Response) => void>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const search = new URL(String(url)).searchParams.get('search') ?? '';
        return new Promise<Response>((resolve) => {
          pending.set(search, resolve);
        });
      }),
    );
    renderField();

    typeSearch('a');
    await waitForPending(pending, 'a');

    typeSearch('ab');
    await waitForPending(pending, 'ab');

    await act(async () => {
      pending.get('ab')?.(jsonResponse(200, page([AB])));
    });
    expect(
      await screen.findByRole('option', { name: 'AB Artist' }),
    ).toBeTruthy();

    await act(async () => {
      pending.get('a')?.(jsonResponse(200, page([A])));
    });
    expect(screen.queryByRole('option', { name: 'A Artist' })).toBeNull();
    expect(screen.getByRole('option', { name: 'AB Artist' })).toBeTruthy();
  });

  it('ошибка поиска показывается рядом с полем и не сбрасывает чипы', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(500, {
          statusCode: 500,
          message: 'Поиск недоступен',
          error: 'Internal Server Error',
          path: '/artists',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderField([QUEEN]);

    typeSearch('Unknown');

    expect(await screen.findByText('Поиск недоступен')).toBeTruthy();
    expect(selectedNames()).toEqual(['Queen']);
  });

  it('«Создать «…»» вызывает POST и выбирает созданного исполнителя', async () => {
    const created = { ...QUEEN, createdAt: '2026-01-01T00:00:00.000Z' };
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        return Promise.resolve(jsonResponse(201, created));
      }
      return Promise.resolve(jsonResponse(200, page([])));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderField();

    typeSearch('Queen');
    fireEvent.click(
      await screen.findByRole(
        'option',
        { name: 'Создать «Queen»' },
        { timeout: 3000 },
      ),
    );

    await screen.findByTestId('selected-artist');
    expect(selectedNames()).toEqual(['Queen']);

    const post = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    );
    if (post === undefined) {
      throw new Error('POST не ушёл');
    }
    const body = (post[1] as RequestInit).body;
    if (typeof body !== 'string') {
      throw new Error('Ожидалось строковое тело запроса');
    }
    expect(JSON.parse(body)).toEqual({ name: 'Queen' });
  });

  it('409 повторяет поиск и выбирает точное совпадение без ошибки', async () => {
    let postAttempted = false;
    const getUrls: string[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        postAttempted = true;
        return Promise.resolve(
          jsonResponse(409, {
            statusCode: 409,
            message: 'Artist with this name already exists',
            error: 'Conflict',
            path: '/artists',
            timestamp: '2026-01-01T00:00:00.000Z',
          }),
        );
      }
      getUrls.push(String(url));
      return Promise.resolve(
        jsonResponse(200, page(postAttempted ? [QUEEN] : [])),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderField();

    typeSearch(' queen ');
    fireEvent.click(
      await screen.findByRole(
        'option',
        { name: 'Создать «queen»' },
        { timeout: 3000 },
      ),
    );

    await screen.findByTestId('selected-artist');
    expect(selectedNames()).toEqual(['Queen']);
    expect(
      screen.queryByText('Artist with this name already exists'),
    ).toBeNull();

    const exactUrl = getUrls
      .map((url) => new URL(url))
      .find((url) => url.searchParams.get('limit') === '100');
    expect(exactUrl?.searchParams.get('search')).toBe('queen');
    expect(exactUrl?.searchParams.get('page')).toBe('1');
  });

  it('409 без точного совпадения показывает ошибку и не добавляет исполнителя', async () => {
    const message = 'Artist with this name already exists';
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        return Promise.resolve(
          jsonResponse(409, {
            statusCode: 409,
            message,
            error: 'Conflict',
            path: '/artists',
            timestamp: '2026-01-01T00:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(
          200,
          page([{ ...QUEEN, name: 'Queens of the Stone Age' }]),
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderField();

    typeSearch('Queen');
    fireEvent.click(
      await screen.findByRole(
        'option',
        { name: 'Создать «Queen»' },
        { timeout: 3000 },
      ),
    );

    expect(await screen.findByText(message)).toBeTruthy();
    expect(selectedNames()).toEqual([]);
  });

  it('стрелки меняют порядок, а выбранные чипы не пропадают при новом поиске', async () => {
    const fetchMock = stubArtistsFetch(() => jsonResponse(200, page([QUEEN])));
    renderField([QUEEN, ADAM]);

    fireEvent.click(screen.getByRole('button', { name: 'Ниже: Queen' }));
    expect(selectedNames()).toEqual(['Adam Lambert', 'Queen']);
    expect(screen.getByRole('button', { name: 'Выше: Queen' })).toBeTruthy();

    typeSearch('Que');
    await screen.findByRole('option', { name: 'Queen' }, { timeout: 3000 });

    expect(selectedNames()).toEqual(['Adam Lambert', 'Queen']);
    expect(
      screen
        .getAllByRole('button', { name: /^Убрать:/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Убрать: Adam Lambert', 'Убрать: Queen']);
    expect(fetchMock).toHaveBeenCalled();
  });
});

const Harness = ({ initial }: { initial: CompositionArtist[] }) => {
  const [value, setValue] = useState<CompositionArtist[]>(initial);
  return (
    <>
      <ArtistsField value={value} onChange={setValue} />
      <div data-testid="selected">
        {value.map((artist) => (
          <span key={artist.id} data-testid="selected-artist">
            {artist.name}
          </span>
        ))}
      </div>
    </>
  );
};

const renderField = (initial: CompositionArtist[] = []) => {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  return render(
    <AppProviders store={store}>
      <Harness initial={initial} />
    </AppProviders>,
  );
};

const typeSearch = (value: string): void => {
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
};

const selectedNames = (): string[] => {
  return screen
    .queryAllByTestId('selected-artist')
    .map((element) => element.textContent ?? '');
};

const waitForPending = async (
  pending: Map<string, (response: Response) => void>,
  search: string,
): Promise<void> => {
  await vi.waitFor(
    () => {
      expect(pending.has(search)).toBe(true);
    },
    { timeout: 3000 },
  );
};

const stubArtistsFetch = (createResponse: () => Response) => {
  const fetchMock = vi.fn((_url: string) => Promise.resolve(createResponse()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const page = (items: unknown[]) => {
  return { items, total: items.length, page: 1, limit: 20 };
};

const jsonResponse = (status: number, body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const createMemoryStorage = (): SessionStorage => {
  const entries = new Map<string, string>();
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
};
