import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../api/api-base-url.ts';
import { makeAccessToken } from './make-access-token.ts';
import {
  EMAIL_KEY,
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from './session-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionStore: login, refresh, logout', () => {
  it('логин 200 пишет пару access и refresh', async () => {
    const access = staffAccess('admin-1');
    const fetchMock = stubFetch(() =>
      jsonResponse(200, { accessToken: access, refreshToken: 'refresh-new' }),
    );
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);

    await session.login('a@example.com', 'secret');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/auth/staff/login`);
    expect(requestBody(fetchMock, 0)).toEqual({
      email: 'a@example.com',
      password: 'secret',
    });
    expect(authorizationHeader(fetchMock, 0)).toBeNull();
    expect(session.accessToken).toBe(access);
    expect(session.refreshToken).toBe('refresh-new');
    expect(session.email).toBe('a@example.com');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-new');
    expect(storage.getItem(EMAIL_KEY)).toBe('a@example.com');
  });

  it('логин 401 — ровно один fetch, стор пустой, без паузы', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(401, {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
        path: '/auth/staff/login',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);

    await expect(session.login('a@example.com', 'bad')).rejects.toMatchObject({
      status: 401,
      messages: ['Invalid credentials'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.email).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('логин 429 — ровно один fetch, стор пустой, без паузы', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(429, {
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
        error: 'Too Many Requests',
        path: '/auth/staff/login',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);

    await expect(
      session.login('a@example.com', 'secret'),
    ).rejects.toMatchObject({ status: 429 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
  });

  it('несколько защищённых 401 делят один refresh со старым токеном и повторяются с новым access', async () => {
    const oldAccess = staffAccess('admin-1', 'v1');
    const newAccess = staffAccess('admin-1', 'v2');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(oldAccess, 'refresh-old', 'a@example.com');

    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith('/admins')) {
        const auth = new Headers(init?.headers).get('Authorization');
        if (auth === `Bearer ${oldAccess}`) {
          return Promise.resolve(
            unauthorizedJson('/admins', 'Invalid or missing access token'),
          );
        }
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      if (String(url).endsWith('/auth/staff/refresh')) {
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: newAccess,
            refreshToken: 'refresh-new',
          }),
        );
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([
      session.api.requestJson('/admins', { method: 'GET' }),
      session.api.requestJson('/admins', { method: 'GET' }),
      session.api.requestJson('/admins', { method: 'GET' }),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);

    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('/auth/staff/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(bodyJson(refreshCalls[0]?.[1])).toEqual({
      refreshToken: 'refresh-old',
    });
    expect(authorizationHeaderFromInit(refreshCalls[0]?.[1])).toBeNull();

    const adminRetryCalls = fetchMock.mock.calls.filter(
      (call) =>
        String(call[0]).endsWith('/admins') &&
        authorizationHeaderFromInit(call[1]) === `Bearer ${newAccess}`,
    );
    expect(adminRetryCalls).toHaveLength(3);
    expect(session.refreshToken).toBe('refresh-new');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-new');
  });

  it('следующий refresh уходит с новым токеном, старого в теле нет', async () => {
    const access1 = staffAccess('admin-1', 'v1');
    const access2 = staffAccess('admin-1', 'v2');
    const access3 = staffAccess('admin-1', 'v3');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(access1, 'refresh-1', 'a@example.com');

    let expiredAccess = access1;
    let refreshRound = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith('/admins')) {
        const auth = new Headers(init?.headers).get('Authorization');
        if (auth === `Bearer ${expiredAccess}`) {
          return Promise.resolve(
            unauthorizedJson('/admins', 'Invalid or missing access token'),
          );
        }
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      if (String(url).endsWith('/auth/staff/refresh')) {
        refreshRound += 1;
        if (refreshRound === 1) {
          return Promise.resolve(
            jsonResponse(200, {
              accessToken: access2,
              refreshToken: 'refresh-2',
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: access3,
            refreshToken: 'refresh-3',
          }),
        );
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await session.api.requestJson('/admins', { method: 'GET' });
    expect(session.refreshToken).toBe('refresh-2');

    expiredAccess = access2;
    await session.api.requestJson('/admins', { method: 'GET' });

    const refreshBodies = fetchMock.mock.calls
      .filter((call) => String(call[0]).endsWith('/auth/staff/refresh'))
      .map((call) => bodyJson(call[1]));

    expect(refreshBodies).toEqual([
      { refreshToken: 'refresh-1' },
      { refreshToken: 'refresh-2' },
    ]);
    expect(session.refreshToken).toBe('refresh-3');
  });
  it('refresh ответил 401: второго refresh нет, токены стёрты, email на месте, запросы не зациклены', async () => {
    const access = staffAccess('admin-1');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(access, 'refresh-old', 'a@example.com');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/admins')) {
        return Promise.resolve(
          jsonResponse(401, {
            statusCode: 401,
            message: 'Invalid or missing access token',
            error: 'Unauthorized',
            path: '/admins',
            timestamp: '2026-09-23T00:00:00.000Z',
          }),
        );
      }
      if (String(url).endsWith('/auth/staff/refresh')) {
        return Promise.resolve(
          jsonResponse(401, {
            statusCode: 401,
            message: 'Invalid or expired refresh token',
            error: 'Unauthorized',
            path: '/auth/staff/refresh',
            timestamp: '2026-09-23T00:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.allSettled([
      session.api.requestJson('/admins', { method: 'GET' }),
      session.api.requestJson('/admins', { method: 'GET' }),
    ]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('/auth/staff/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.email).toBe('a@example.com');
    expect(storage.getItem(EMAIL_KEY)).toBe('a@example.com');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    // 2 исходных + 1 refresh, без повторов исходных
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refresh 429: ключ refresh на месте, третьего запроса нет', async () => {
    const access = staffAccess('admin-1');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(access, 'refresh-keep', 'a@example.com');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/items')) {
        return Promise.resolve(
          jsonResponse(401, {
            statusCode: 401,
            message: 'Invalid or missing access token',
            error: 'Unauthorized',
            path: '/items',
            timestamp: '2026-09-23T00:00:00.000Z',
          }),
        );
      }
      if (String(url).endsWith('/auth/staff/refresh')) {
        return Promise.resolve(
          jsonResponse(429, {
            statusCode: 429,
            message: 'ThrottlerException: Too Many Requests',
            error: 'Too Many Requests',
            path: '/auth/staff/refresh',
            timestamp: '2026-09-23T00:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      session.api.requestJson('/items', { method: 'GET' }),
    ).rejects.toMatchObject({ status: 429 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(session.refreshToken).toBe('refresh-keep');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
  });

  it('сетевой отказ refresh: ключ refresh на месте, третьего запроса нет', async () => {
    const access = staffAccess('admin-1');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(access, 'refresh-keep', 'a@example.com');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/items')) {
        return Promise.resolve(
          jsonResponse(401, {
            statusCode: 401,
            message: 'Invalid or missing access token',
            error: 'Unauthorized',
            path: '/items',
            timestamp: '2026-09-23T00:00:00.000Z',
          }),
        );
      }
      if (String(url).endsWith('/auth/staff/refresh')) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      session.api.requestJson('/items', { method: 'GET' }),
    ).rejects.toMatchObject({ status: null });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(session.refreshToken).toBe('refresh-keep');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
  });

  it('разборщик сказал «не токен»: refresh не вызывается, сессия на месте', async () => {
    const access = staffAccess('admin-1');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(access, 'refresh-keep', 'a@example.com');

    const fetchMock = stubFetch(() =>
      jsonResponse(401, {
        statusCode: 401,
        message: 'Current password is incorrect',
        error: 'Unauthorized',
        path: '/admins/me/password',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );

    const error = await rejection(
      session.api.requestJson('/admins/me/password', {
        method: 'PATCH',
        body: { currentPassword: 'x', newPassword: 'yyyyyyyy' },
        isNonTokenUnauthorized: (err) =>
          err.messages.includes('Current password is incorrect'),
      }),
    );

    expect(error).toMatchObject({
      status: 401,
      messages: ['Current password is incorrect'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.accessToken).toBe(access);
    expect(session.refreshToken).toBe('refresh-keep');
  });

  it('после refresh повторный 401 «не токен» не стирает новую пару', async () => {
    const oldAccess = staffAccess('admin-1', 'v1');
    const newAccess = staffAccess('admin-1', 'v2');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(oldAccess, 'refresh-old', 'a@example.com');

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).endsWith('/admins/me/password')) {
          const auth = new Headers(init?.headers).get('Authorization');
          if (auth === `Bearer ${oldAccess}`) {
            return Promise.resolve(
              unauthorizedJson(
                '/admins/me/password',
                'Invalid or missing access token',
              ),
            );
          }
          return Promise.resolve(
            jsonResponse(401, {
              statusCode: 401,
              message: 'Current password is incorrect',
              error: 'Unauthorized',
              path: '/admins/me/password',
              timestamp: '2026-09-23T00:00:00.000Z',
            }),
          );
        }
        if (String(url).endsWith('/auth/staff/refresh')) {
          return Promise.resolve(
            jsonResponse(200, {
              accessToken: newAccess,
              refreshToken: 'refresh-new',
            }),
          );
        }
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      });
    vi.stubGlobal('fetch', fetchMock);

    const error = await rejection(
      session.api.requestJson('/admins/me/password', {
        method: 'PATCH',
        body: { currentPassword: 'wrong', newPassword: 'yyyyyyyy' },
        isNonTokenUnauthorized: (err) =>
          err.messages.includes('Current password is incorrect'),
      }),
    );

    expect(error).toMatchObject({
      status: 401,
      messages: ['Current password is incorrect'],
    });
    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('/auth/staff/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(session.accessToken).toBe(newAccess);
    expect(session.refreshToken).toBe('refresh-new');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-new');
  });

  it('логин 401 при уже лежащем refresh не трогает хранилище и не зовёт refresh', async () => {
    const storage = createMemoryStorage({
      [REFRESH_TOKEN_KEY]: 'refresh-kept',
      [EMAIL_KEY]: 'old@example.com',
    });
    const session = new SessionStore(storage);
    const fetchMock = stubFetch(() =>
      jsonResponse(401, {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
        path: '/auth/staff/login',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );

    await expect(session.login('a@example.com', 'bad')).rejects.toMatchObject({
      status: 401,
      messages: ['Invalid credentials'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/auth/staff/login`);
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBe('refresh-kept');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-kept');
  });

  it('logout при 204 очищает хранилище', async () => {
    const access = staffAccess('admin-1');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(access, 'refresh-1', 'a@example.com');

    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));

    await session.logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/auth/staff/logout`);
    expect(requestBody(fetchMock, 0)).toEqual({ refreshToken: 'refresh-1' });
    expect(authorizationHeader(fetchMock, 0)).toBeNull();
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.email).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(storage.getItem(EMAIL_KEY)).toBeNull();
  });

  it('logout при сетевом отказе очищает хранилище', async () => {
    const access = staffAccess('admin-1');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(access, 'refresh-1', 'a@example.com');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    await session.logout();

    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.email).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(storage.getItem(EMAIL_KEY)).toBeNull();
  });

  it('logout без сохранённого refresh не делает fetch', async () => {
    const storage = createMemoryStorage({
      [EMAIL_KEY]: 'a@example.com',
    });
    const session = new SessionStore(storage);
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));

    await session.logout();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(session.email).toBeNull();
    expect(storage.getItem(EMAIL_KEY)).toBeNull();
  });

  it('restore без refresh ничего не шлёт', async () => {
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));

    await session.restore();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('повторный 401 исходного запроса после ротации очищает токены и не делает второй refresh', async () => {
    const oldAccess = staffAccess('admin-1', 'v1');
    const newAccess = staffAccess('admin-1', 'v2');
    const storage = createMemoryStorage();
    const session = new SessionStore(storage);
    session.setPair(oldAccess, 'refresh-old', 'a@example.com');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/admins')) {
        return Promise.resolve(
          jsonResponse(401, {
            statusCode: 401,
            message: 'Invalid or missing access token',
            error: 'Unauthorized',
            path: '/admins',
            timestamp: '2026-09-23T00:00:00.000Z',
          }),
        );
      }
      if (String(url).endsWith('/auth/staff/refresh')) {
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: newAccess,
            refreshToken: 'refresh-new',
          }),
        );
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      session.api.requestJson('/admins', { method: 'GET' }),
    ).rejects.toMatchObject({ status: 401 });

    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('/auth/staff/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    // исходный + refresh + повтор = 3
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.email).toBe('a@example.com');
  });
});

function staffAccess(sub: string, stamp = '0'): string {
  return makeAccessToken({ sub, role: 'ADMIN', type: 'staff', stamp });
}

function bodyJson(init: unknown): unknown {
  const body = (init as RequestInit | undefined)?.body;
  if (typeof body !== 'string') {
    throw new Error('Ожидалось строковое тело запроса');
  }
  return JSON.parse(body);
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

function unauthorizedJson(path: string, message: string): Response {
  return jsonResponse(401, {
    statusCode: 401,
    message,
    error: 'Unauthorized',
    path,
    timestamp: '2026-09-23T00:00:00.000Z',
  });
}
function fetchUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): string {
  return String(fetchMock.mock.calls[index]?.[0]);
}

function requestBody(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): unknown {
  return bodyJson(fetchMock.mock.calls[index]?.[1]);
}

function authorizationHeader(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): string | null {
  return authorizationHeaderFromInit(fetchMock.mock.calls[index]?.[1]);
}

function authorizationHeaderFromInit(init: unknown): string | null {
  const headers = new Headers((init as RequestInit | undefined)?.headers);
  return headers.get('Authorization');
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

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Ожидалось отклонение промиса');
}
