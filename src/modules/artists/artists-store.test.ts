import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../../shared/api/api-base-url.ts';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';
import { SessionStore, type SessionStorage } from '../session/session-store.ts';
import { ArtistsStore, type Artist } from './artists-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ArtistsStore', () => {
  it('list шлёт search, page и limit; пустой search параметра не содержит', async () => {
    const { artists, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, emptyPage());

    await artists.list({ search: 'Que', page: 1, limit: 20 });

    const url = new URL(fetchUrl(fetchMock, 0));
    expect(url.pathname).toBe('/artists');
    expect(url.searchParams.get('search')).toBe('Que');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('20');

    fetchMock.mockClear();
    stubJsonOk(fetchMock, emptyPage());
    await artists.list({ search: '   ' });
    expect(new URL(fetchUrl(fetchMock, 0)).searchParams.has('search')).toBe(
      false,
    );
  });

  it('ответ списка типизирован с createdAt', async () => {
    const artist = sampleArtist();
    const { artists, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, { items: [artist], total: 1, page: 1, limit: 20 });

    const page = await artists.list({ search: 'Queen' });

    expect(page.items[0]).toEqual(artist);
    expect(page.items[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('create отправляет ровно { name }', async () => {
    const created = sampleArtist();
    const { artists, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, created, 201);

    await expect(artists.create({ name: 'Queen' })).resolves.toEqual(created);

    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/artists`);
    expect(requestMethod(fetchMock, 0)).toBe('POST');
    expect(requestBody(fetchMock, 0)).toEqual({ name: 'Queen' });
  });
});

const createStoreWithSession = (): {
  artists: ArtistsStore;
  fetchMock: ReturnType<typeof vi.fn>;
} => {
  const storage = createMemoryStorage();
  const session = new SessionStore(storage);
  session.setPair(
    makeAccessToken({ sub: 'sa-1', role: 'SUPER_ADMIN', type: 'staff' }),
    'refresh-keep',
    'sa@example.com',
  );

  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  return { artists: new ArtistsStore(session.api), fetchMock };
};

const sampleArtist = (overrides: Partial<Artist> = {}): Artist => {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Queen',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
};

const emptyPage = () => {
  return { items: [], total: 0, page: 1, limit: 20 };
};

const stubJsonOk = (
  fetchMock: ReturnType<typeof vi.fn>,
  body: unknown,
  status = 200,
): void => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(jsonResponse(status, body)),
  );
};

const jsonResponse = (status: number, body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const fetchUrl = (
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): string => {
  return String(fetchMock.mock.calls[index]?.[0]);
};

const requestMethod = (
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): string | undefined => {
  return (fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)?.method;
};

const requestBody = (
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): Record<string, unknown> => {
  const body = (fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)
    ?.body;
  if (typeof body !== 'string') {
    throw new Error('Ожидалось строковое тело запроса');
  }
  return JSON.parse(body) as Record<string, unknown>;
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
