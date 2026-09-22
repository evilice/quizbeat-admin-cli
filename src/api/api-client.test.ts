import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from './api-base-url.ts';
import { ApiError } from './api-error.ts';
import { createApiClient } from './api-client.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createApiClient', () => {
  it('отдаёт message строкой как список из одной строки', async () => {
    stubFetch(() =>
      jsonResponse(401, {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
        path: '/auth/staff/login',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );
    const client = createApiClient(() => null);

    await expect(
      client.requestJson('/auth/staff/login', { method: 'POST' }),
    ).rejects.toMatchObject({
      status: 401,
      messages: ['Invalid credentials'],
    });
  });

  it('отдаёт все элементы message, если сервер прислал массив', async () => {
    stubFetch(() =>
      jsonResponse(400, {
        statusCode: 400,
        message: ['email must be an email', 'password must be longer'],
        error: 'Bad Request',
        path: '/auth/staff/login',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );
    const client = createApiClient(() => null);

    await expect(
      client.requestJson('/auth/staff/login', { method: 'POST' }),
    ).rejects.toMatchObject({
      status: 400,
      messages: ['email must be an email', 'password must be longer'],
    });
  });

  it('сохраняет details и не теряет статус', async () => {
    stubFetch(() =>
      jsonResponse(402, {
        statusCode: 402,
        message: 'Payment required',
        error: 'HttpException',
        path: '/x',
        timestamp: '2026-09-23T00:00:00.000Z',
        details: { code: 'X' },
      }),
    );
    const client = createApiClient(() => null);

    const error = await rejection(client.requestJson('/x', { method: 'POST' }));

    expect(error).toMatchObject({
      status: 402,
      messages: ['Payment required'],
      details: { code: 'X' },
    });
  });

  it('возвращает undefined для 204 без тела', async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const client = createApiClient(() => 'access-token');

    await expect(
      client.requestJson('/auth/staff/logout', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('на не-JSON теле HTTP-ошибки отдаёт статус и не бросает ошибку парсера', async () => {
    stubFetch(() => new Response('not-json', { status: 502 }));
    const client = createApiClient(() => null);

    const error = await rejection(client.request('/health', { method: 'GET' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502 });
    expect((error as ApiError).message).not.toContain('Unexpected token');
  });

  it('ставит Bearer только для непустого токена', async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { ok: true }));

    await createApiClient(() => 'access-token').requestJson('/admins', {
      method: 'GET',
    });
    expect(authorizationHeader(fetchMock)).toBe('Bearer access-token');

    fetchMock.mockClear();
    await createApiClient(() => null).requestJson('/admins', { method: 'GET' });
    expect(authorizationHeader(fetchMock)).toBeNull();

    fetchMock.mockClear();
    await createApiClient(() => '').requestJson('/admins', { method: 'GET' });
    expect(authorizationHeader(fetchMock)).toBeNull();
  });

  it('на 401 делает ровно один запрос', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(401, {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
        path: '/admins',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );
    const client = createApiClient(() => 'access-token');

    await expect(
      client.requestJson('/admins', { method: 'GET' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('сетевой отказ не выглядит как HTTP-ошибка', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    const client = createApiClient(() => 'access-token');

    const error = await rejection(client.request('/admins', { method: 'GET' }));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBeNull();
  });

  it('JSON-обёртка сериализует тело и ставит Content-Type, низкоуровневый вызов — нет', async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { id: '1' }));
    const client = createApiClient(() => null);

    await expect(
      client.requestJson('/tags', {
        method: 'POST',
        body: { code: 'rock' },
      }),
    ).resolves.toEqual({ id: '1' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBaseUrl}/tags`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'rock' }),
      }),
    );
    expect(contentTypeHeader(fetchMock)).toBe('application/json');

    const rawFetch = stubFetch(() => new Response(null, { status: 204 }));
    await client.request('/audio', {
      method: 'POST',
      body: new FormData(),
    });
    expect(contentTypeHeader(rawFetch)).toBeNull();
  });
});

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

function authorizationHeader(
  fetchMock: ReturnType<typeof vi.fn>,
): string | null {
  return requestHeaders(fetchMock).get('Authorization');
}

function contentTypeHeader(fetchMock: ReturnType<typeof vi.fn>): string | null {
  return requestHeaders(fetchMock).get('Content-Type');
}

function requestHeaders(fetchMock: ReturnType<typeof vi.fn>): Headers {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return new Headers(init?.headers);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Ожидалось отклонение промиса');
}
