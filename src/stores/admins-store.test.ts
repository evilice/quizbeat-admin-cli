import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../api/api-base-url.ts';
import { ApiError } from '../api/api-error.ts';
import { AdminsStore } from './admins-store.ts';
import { makeAccessToken } from './make-access-token.ts';
import {
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from './session-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminsStore', () => {
  it('фильтр неактивных содержит ровно isActive=false', async () => {
    const { admins, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, emptyPage());

    await admins.list({ isActive: false });

    const url = new URL(fetchUrl(fetchMock, 0));
    expect(url.pathname).toBe('/admins');
    expect(url.searchParams.getAll('isActive')).toEqual(['false']);
    expect(url.searchParams.has('isActive')).toBe(true);
    expect(url.search).not.toContain('isActive=&');
    expect(url.search).not.toContain('isActive=true');
  });

  it('состояние «все» без isActive; пустой поиск без search', async () => {
    const { admins, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, emptyPage());

    await admins.list({ search: '', page: 2, limit: 10 });

    const url = new URL(fetchUrl(fetchMock, 0));
    expect(url.searchParams.has('isActive')).toBe(false);
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('DELETE читает JSON-тело и не считает пустой 204 успехом', async () => {
    const adminId = '11111111-1111-1111-1111-111111111111';
    const deactivated = sampleAdmin({ id: adminId, isActive: false });
    const { admins, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, deactivated)),
    );

    await expect(admins.deactivate(adminId)).resolves.toEqual(deactivated);
    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/admins/${adminId}`);
    expect(requestMethod(fetchMock, 0)).toBe('DELETE');

    fetchMock.mockClear();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(admins.deactivate(adminId)).rejects.toBeInstanceOf(ApiError);
  });

  it('сброс пароля шлёт { newPassword } на путь с uuid без me и currentPassword', async () => {
    const adminId = '22222222-2222-2222-2222-222222222222';
    const { admins, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(
      admins.resetPassword(adminId, 'new-secret-8'),
    ).resolves.toBeUndefined();

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/admins/${adminId}/password`,
    );
    expect(fetchUrl(fetchMock, 0)).not.toContain('/me/');
    expect(requestMethod(fetchMock, 0)).toBe('PATCH');
    expect(requestBody(fetchMock, 0)).toEqual({ newPassword: 'new-secret-8' });
    expect(requestBody(fetchMock, 0)).not.toHaveProperty('currentPassword');
  });

  it('при 403 вызов падает с message сервера, refresh остаётся, refresh не вызывается', async () => {
    const { admins, fetchMock, storage } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        errorJson(403, 'Forbidden resource', '/admins'),
      ),
    );

    await expect(admins.list()).rejects.toMatchObject({
      status: 403,
      messages: ['Forbidden resource'],
      message: 'Forbidden resource',
    });

    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });

  it('при 409 вызов падает с message сервера, refresh остаётся, refresh не вызывается', async () => {
    const { admins, fetchMock, storage } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        errorJson(
          409,
          'Cannot deactivate or demote the last active SUPER_ADMIN',
          '/admins/11111111-1111-1111-1111-111111111111',
        ),
      ),
    );

    await expect(
      admins.update('11111111-1111-1111-1111-111111111111', {
        role: 'ADMIN',
      }),
    ).rejects.toMatchObject({
      status: 409,
      messages: [
        'Cannot deactivate or demote the last active SUPER_ADMIN',
      ],
      message: 'Cannot deactivate or demote the last active SUPER_ADMIN',
    });

    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });

  it('создание шлёт email, password, role; в ответе пароля нет', async () => {
    const created = sampleAdmin();
    const { admins, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, created, 201);

    const result = await admins.create({
      email: 'new@example.com',
      password: 'secret-password',
      role: 'ADMIN',
    });

    expect(requestBody(fetchMock, 0)).toEqual({
      email: 'new@example.com',
      password: 'secret-password',
      role: 'ADMIN',
    });
    expect(result).toEqual(created);
    expect(result).not.toHaveProperty('password');
  });

  it('правка шлёт в теле только переданные role и/или isActive как boolean', async () => {
    const adminId = '33333333-3333-3333-3333-333333333333';
    const { admins, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, sampleAdmin({ id: adminId, isActive: true }));

    await admins.update(adminId, { isActive: true });

    expect(requestBody(fetchMock, 0)).toEqual({ isActive: true });
    expect(typeof requestBody(fetchMock, 0).isActive).toBe('boolean');
  });
});

function createStoreWithSession(): {
  admins: AdminsStore;
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
    admins: new AdminsStore(session.api),
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

function sampleAdmin(
  overrides: Partial<{
    id: string;
    email: string;
    role: 'ADMIN' | 'SUPER_ADMIN';
    isActive: boolean;
  }> = {},
) {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'admin@example.com',
    role: 'ADMIN' as const,
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
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
    error: status === 403 ? 'Forbidden' : 'Conflict',
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
