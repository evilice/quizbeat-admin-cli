import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../api/api-base-url.ts';
import { makeAccessToken } from './make-access-token.ts';
import {
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from './session-store.ts';
import { TagsStore } from './tags-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TagsStore', () => {
  it('непустой search уходит одним query-параметром; пустой и пробелы search не содержат', async () => {
    const { tags, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, emptyPage());

    await tags.list({ search: 'рок', page: 2, limit: 10 });

    const withSearch = new URL(fetchUrl(fetchMock, 0));
    expect(withSearch.pathname).toBe('/tags');
    expect(withSearch.searchParams.getAll('search')).toEqual(['рок']);
    expect(withSearch.searchParams.get('page')).toBe('2');
    expect(withSearch.searchParams.get('limit')).toBe('10');

    fetchMock.mockClear();
    stubJsonOk(fetchMock, emptyPage());
    await tags.list({ search: '' });
    expect(new URL(fetchUrl(fetchMock, 0)).searchParams.has('search')).toBe(
      false,
    );

    fetchMock.mockClear();
    stubJsonOk(fetchMock, emptyPage());
    await tags.list({ search: '   ' });
    expect(new URL(fetchUrl(fetchMock, 0)).searchParams.has('search')).toBe(
      false,
    );
  });

  it('POST отправляет translations массивом из двух элементов с locale и name', async () => {
    const created = sampleTag();
    const { tags, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, created, 201);

    const translations = [
      { locale: 'ru' as const, name: 'Рок' },
      { locale: 'en' as const, name: 'Rock' },
    ];
    const result = await tags.create({
      code: 'rock',
      translations,
    });

    const body = requestBody(fetchMock, 0);
    expect(body).toEqual({
      code: 'rock',
      translations,
    });
    expect(Array.isArray(body.translations)).toBe(true);
    expect(body.translations).toHaveLength(2);
    expect(body).not.toHaveProperty('text');
    expect(
      typeof body.translations === 'object' &&
        body.translations !== null &&
        !Array.isArray(body.translations) &&
        ('ru' in body.translations || 'en' in body.translations),
    ).toBe(false);
    for (const item of body.translations as unknown[]) {
      expect(item).toEqual(
        expect.objectContaining({
          locale: expect.any(String),
          name: expect.any(String),
        }),
      );
      expect(item).not.toHaveProperty('text');
    }
    expect(result).toEqual(created);
  });

  it('PATCH на путь с uuid отправляет оба переданных перевода', async () => {
    const tagId = '11111111-1111-1111-1111-111111111111';
    const translations = [
      { locale: 'ru' as const, name: 'Джаз' },
      { locale: 'en' as const, name: 'Jazz' },
    ];
    const { tags, fetchMock } = createStoreWithSession();
    stubJsonOk(
      fetchMock,
      sampleTag({ id: tagId, code: 'jazz', translations }),
    );

    await tags.update(tagId, { code: 'jazz', translations });

    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/tags/${tagId}`);
    expect(requestMethod(fetchMock, 0)).toBe('PATCH');
    const body = requestBody(fetchMock, 0);
    expect(body.code).toBe('jazz');
    expect(body.translations).toEqual(translations);
    expect(body.translations).toHaveLength(2);
  });

  it('DELETE с пустым телом и кодом 204 считается успехом', async () => {
    const tagId = '22222222-2222-2222-2222-222222222222';
    const { tags, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(tags.remove(tagId)).resolves.toBeUndefined();

    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/tags/${tagId}`);
    expect(requestMethod(fetchMock, 0)).toBe('DELETE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('при 404 вызов падает с message сервера, refresh остаётся, refresh не вызывается', async () => {
    const tagId = '33333333-3333-3333-3333-333333333333';
    const { tags, fetchMock, storage } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorJson(404, 'Tag not found', `/tags/${tagId}`)),
    );

    await expect(tags.remove(tagId)).rejects.toMatchObject({
      status: 404,
      messages: ['Tag not found'],
      message: 'Tag not found',
    });

    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });

  it('при 409 вызов падает с message сервера, refresh остаётся, refresh не вызывается', async () => {
    const { tags, fetchMock, storage } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        errorJson(409, 'Tag with this code already exists', '/tags'),
      ),
    );

    await expect(
      tags.create({
        code: 'rock',
        translations: [
          { locale: 'ru', name: 'Рок' },
          { locale: 'en', name: 'Rock' },
        ],
      }),
    ).rejects.toMatchObject({
      status: 409,
      messages: ['Tag with this code already exists'],
      message: 'Tag with this code already exists',
    });

    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });
});

function createStoreWithSession(): {
  tags: TagsStore;
  fetchMock: ReturnType<typeof vi.fn>;
  storage: SessionStorage & { entries: Map<string, string> };
  session: SessionStore;
} {
  const storage = createMemoryStorage();
  const session = new SessionStore(storage);
  const access = makeAccessToken({
    sub: 'sa-1',
    role: 'SUPER_ADMIN',
    type: 'staff',
  });
  session.setPair(access, 'refresh-keep', 'sa@example.com');

  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  return {
    tags: new TagsStore(session.api),
    fetchMock,
    storage,
    session,
  };
}

function stubJsonOk(
  fetchMock: ReturnType<typeof vi.fn>,
  body: unknown,
  status = 200,
): void {
  fetchMock.mockImplementation(() =>
    Promise.resolve(jsonResponse(status, body)),
  );
}

function emptyPage() {
  return { items: [], total: 0, page: 1, limit: 20 };
}

function sampleTag(
  overrides: Partial<{
    id: string;
    code: string;
    translations: { locale: 'ru' | 'en'; name: string }[];
  }> = {},
) {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    code: 'rock',
    translations: [
      { locale: 'ru' as const, name: 'Рок' },
      { locale: 'en' as const, name: 'Rock' },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorJson(status: number, message: string, path: string): Response {
  return jsonResponse(status, {
    statusCode: status,
    message,
    error:
      status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Error',
    path,
    timestamp: '2026-09-24T00:00:00.000Z',
  });
}

function fetchUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): string {
  return String(fetchMock.mock.calls[index]?.[0]);
}

function requestMethod(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): string | undefined {
  return (fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)?.method;
}

function requestBody(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): Record<string, unknown> {
  const body = (fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)
    ?.body;
  if (typeof body !== 'string') {
    throw new Error('Ожидалось строковое тело запроса');
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function createMemoryStorage(
  initial: Record<string, string> = {},
): SessionStorage & { entries: Map<string, string> } {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
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
