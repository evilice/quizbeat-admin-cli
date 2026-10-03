import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../../shared/api/api-base-url.ts';
import { ApiError } from '../../shared/api/api-error.ts';
import {
  CompositionsStore,
  type Composition,
  type CompositionFull,
} from './compositions-store.ts';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';
import {
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from '../../modules/session/session-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const TAG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TAG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const UNKNOWN_TAG_MESSAGE =
  'One or more tagIds do not reference an existing tag';

describe('CompositionsStore', () => {
  it('два uuid в фильтре уходят одним query-параметром tagIds без второго ключа', async () => {
    const { compositions, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, emptyPage());

    await compositions.list({ tagIds: [TAG_A, TAG_B] });

    const url = new URL(fetchUrl(fetchMock, 0));
    expect(url.pathname).toBe('/compositions');
    expect(url.searchParams.getAll('tagIds')).toEqual([`${TAG_A},${TAG_B}`]);
    expect(url.searchParams.get('tagIds')).toBe(`${TAG_A},${TAG_B}`);
  });

  it('пустой search, отсутствие status и пустой/отсутствующий tagIds не содержат параметров', async () => {
    const { compositions, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, emptyPage());

    await compositions.list({ search: '', page: 2, limit: 10 });

    let url = new URL(fetchUrl(fetchMock, 0));
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.has('status')).toBe(false);
    expect(url.searchParams.has('tagIds')).toBe(false);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('10');

    fetchMock.mockClear();
    stubJsonOk(fetchMock, emptyPage());
    await compositions.list({ search: '   ', tagIds: [] });
    url = new URL(fetchUrl(fetchMock, 0));
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.has('tagIds')).toBe(false);

    fetchMock.mockClear();
    stubJsonOk(fetchMock, emptyPage());
    await compositions.list({});
    url = new URL(fetchUrl(fetchMock, 0));
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.has('status')).toBe(false);
    expect(url.searchParams.has('tagIds')).toBe(false);
  });

  it('status уходит только если передан', async () => {
    const { compositions, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, emptyPage());

    await compositions.list({ status: 'DRAFT' });

    const url = new URL(fetchUrl(fetchMock, 0));
    expect(url.searchParams.getAll('status')).toEqual(['DRAFT']);
  });

  it('POST без status и tagIds не кладёт эти поля; с tagIds шлёт массив', async () => {
    const created = sampleComposition();
    const { compositions, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, created, 201);

    await compositions.create({ title: 'Song', author: 'Author' });

    expect(requestBody(fetchMock, 0)).toEqual({
      title: 'Song',
      author: 'Author',
    });
    expect(requestBody(fetchMock, 0)).not.toHaveProperty('status');
    expect(requestBody(fetchMock, 0)).not.toHaveProperty('tagIds');

    fetchMock.mockClear();
    stubJsonOk(fetchMock, created, 201);
    await compositions.create({
      title: 'Song',
      author: 'Author',
      status: 'PUBLISHED',
      tagIds: [TAG_A],
    });

    expect(requestBody(fetchMock, 0)).toEqual({
      title: 'Song',
      author: 'Author',
      status: 'PUBLISHED',
      tagIds: [TAG_A],
    });
  });

  it('PATCH с tagIds: [] содержит ключ со значением []; без tagIds ключа нет', async () => {
    const { compositions, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, sampleComposition({ id: COMPOSITION_ID }));

    await compositions.update(COMPOSITION_ID, { tagIds: [] });

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('PATCH');
    expect(requestBody(fetchMock, 0)).toEqual({ tagIds: [] });
    expect(requestBody(fetchMock, 0)).toHaveProperty('tagIds');

    fetchMock.mockClear();
    stubJsonOk(fetchMock, sampleComposition({ id: COMPOSITION_ID }));
    await compositions.update(COMPOSITION_ID, { title: 'New title' });

    expect(requestBody(fetchMock, 0)).toEqual({ title: 'New title' });
    expect(requestBody(fetchMock, 0)).not.toHaveProperty('tagIds');
  });

  it('DELETE с телом 200 и deletedAt считается успехом и возвращает объект', async () => {
    const deleted = sampleComposition({
      id: COMPOSITION_ID,
      deletedAt: '2026-09-25T10:00:00.000Z',
    });
    const { compositions, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, deleted);

    await expect(compositions.remove(COMPOSITION_ID)).resolves.toEqual(deleted);

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('DELETE');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(compositions.remove(COMPOSITION_ID)).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('при 400 про неизвестный тег и при 404 ошибка с message, refresh остаётся', async () => {
    const { compositions, fetchMock, storage } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorJson(400, UNKNOWN_TAG_MESSAGE, '/compositions')),
    );

    await expect(
      compositions.create({
        title: 'Song',
        author: 'Author',
        tagIds: [TAG_A],
      }),
    ).rejects.toMatchObject({
      status: 400,
      messages: [UNKNOWN_TAG_MESSAGE],
      message: UNKNOWN_TAG_MESSAGE,
    });

    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');

    fetchMock.mockClear();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        errorJson(404, 'Not Found', `/compositions/${COMPOSITION_ID}`),
      ),
    );

    await expect(
      compositions.update(COMPOSITION_ID, { title: 'X' }),
    ).rejects.toMatchObject({
      status: 404,
      messages: ['Not Found'],
      message: 'Not Found',
    });

    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });

  it('full: один вызов на /full; null аудио и массивы принимаются; 404 без очистки refresh', async () => {
    const full = sampleCompositionFull({
      originalAudioUrl: null,
      originalAudioDurationSec: null,
      clips: [],
      images: [],
      notes: [],
    });
    const { compositions, fetchMock, storage } = createStoreWithSession();
    stubJsonOk(fetchMock, full);

    const result = await compositions.full(COMPOSITION_ID);

    expect(result).toEqual(full);
    expect(result.originalAudioUrl).toBeNull();
    expect(result.originalAudioDurationSec).toBeNull();
    expect(result.clips).toEqual([]);
    expect(result.images).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/full`,
    );
    expect(fetchUrl(fetchMock, 0)).not.toContain('/audio');
    expect(requestMethod(fetchMock, 0)).toBe('GET');

    const allUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(allUrls.every((url) => !url.endsWith('/audio'))).toBe(true);
    expect(allUrls.every((url) => !url.includes('/audio?'))).toBe(true);

    fetchMock.mockClear();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        errorJson(404, 'Not Found', `/compositions/${COMPOSITION_ID}/full`),
      ),
    );

    await expect(compositions.full(COMPOSITION_ID)).rejects.toMatchObject({
      status: 404,
      messages: ['Not Found'],
      message: 'Not Found',
    });

    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });
});

function createStoreWithSession(): {
  compositions: CompositionsStore;
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
    compositions: new CompositionsStore(session.api),
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

function sampleComposition(overrides: Partial<Composition> = {}): Composition {
  return {
    id: COMPOSITION_ID,
    title: 'Song',
    author: 'Author',
    status: 'DRAFT',
    createdById: 'sa-1',
    tags: [],
    deletedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function sampleCompositionFull(
  overrides: Partial<CompositionFull> = {},
): CompositionFull {
  return {
    ...sampleComposition(),
    originalAudioUrl: null,
    originalAudioDurationSec: null,
    clips: [],
    images: [],
    notes: [],
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
      status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' : 'Error',
    path,
    timestamp: '2026-09-25T00:00:00.000Z',
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
