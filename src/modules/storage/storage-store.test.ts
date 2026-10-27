import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../../shared/api/api-base-url.ts';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';
import {
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from '../session/session-store.ts';
import {
  STORAGE_OUTCOME_UNKNOWN_MESSAGE,
  STORAGE_PREVIEW_STALE_MESSAGE,
} from './storage-display.ts';
import {
  PREVIEW_MAX_AGE_MS,
  StorageStore,
  type StorageSweepResult,
} from './storage-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StorageStore', () => {
  it('предпросмотр шлёт apply: false, удаление — apply: true и сбрасывает предпросмотр', async () => {
    const preview = sampleResult({
      applied: false,
      total: { count: 3, bytes: 2048 },
    });
    const outcome = sampleResult({
      applied: true,
      total: { count: 2, bytes: 1024 },
      failed: 1,
      failedBytes: 512,
    });
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const apply = applyFlag(init);
      return Promise.resolve(jsonResponse(200, apply ? outcome : preview));
    });

    await storage.preview();

    expect(fetchUrl(fetchMock, 0)).toBe(`${apiBaseUrl}/storage/sweep`);
    expect(requestMethod(fetchMock, 0)).toBe('POST');
    expect(requestBody(fetchMock, 0)).toEqual({ apply: false });
    expect(typeof requestBody(fetchMock, 0).apply).toBe('boolean');
    expect(requestInit(fetchMock, 0).signal).toBeUndefined();
    expect(storage.previewResult).toEqual(preview);
    expect(storage.outcome).toBeNull();
    expect(storage.pending).toBe(false);

    await storage.sweep();

    expect(requestBody(fetchMock, 1)).toEqual({ apply: true });
    expect(typeof requestBody(fetchMock, 1).apply).toBe('boolean');
    expect(storage.outcome).toEqual(outcome);
    expect(storage.outcome?.total).not.toEqual(preview.total);
    expect(storage.previewResult).toBeNull();
    expect(storage.pending).toBe(false);
  });

  it('повторный вызов во время запроса игнорируется', async () => {
    const preview = sampleResult({ applied: false });
    const { storage, fetchMock } = createStoreWithSession();
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = storage.preview();
    const second = storage.preview();
    expect(storage.pending).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, preview));
    await first;
    await second;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.previewResult).toEqual(preview);
    expect(storage.pending).toBe(false);
  });

  it('сброс во время удаления его не обрывает: итог доходит до стора', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    const preview = sampleResult({
      applied: false,
      total: { count: 1, bytes: 10 },
    });
    const outcome = sampleResult({
      applied: true,
      total: { count: 1, bytes: 10 },
    });
    let resolveSweep: (response: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, preview)))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSweep = resolve;
          }),
      );
    await storage.preview();

    const pending = storage.sweep();
    storage.reset();
    expect(storage.pending).toBe(true);
    resolveSweep(jsonResponse(200, outcome));
    await pending;

    expect(storage.outcome).toEqual(outcome);
    expect(storage.pending).toBe(false);
  });

  it('сброс без запроса очищает предпросмотр и сообщения, готовый итог остаётся', async () => {
    const outcome = sampleResult({
      applied: true,
      total: { count: 1, bytes: 10 },
      failed: 1,
    });
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        jsonResponse(
          200,
          applyFlag(init)
            ? outcome
            : sampleResult({ applied: false, total: { count: 1, bytes: 10 } }),
        ),
      ),
    );
    await storage.preview();
    storage.reset();
    expect(storage.previewResult).toBeNull();

    await storage.preview();
    await storage.sweep();
    storage.reset();

    expect(storage.outcome).toEqual(outcome);
    expect(storage.messages).toEqual([]);
  });

  it('устаревший предпросмотр не уходит на удаление и сбрасывается', async () => {
    vi.useFakeTimers();
    try {
      const preview = sampleResult({
        applied: false,
        total: { count: 1, bytes: 10 },
      });
      const { storage, fetchMock } = createStoreWithSession();
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse(200, preview)),
      );
      await storage.preview();

      vi.advanceTimersByTime(PREVIEW_MAX_AGE_MS + 1);
      await storage.sweep();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(storage.previewResult).toBeNull();
      expect(storage.messages).toEqual([STORAGE_PREVIEW_STALE_MESSAGE]);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['обрыв сети', () => Promise.reject(new TypeError('Failed to fetch'))],
    [
      '500',
      () => Promise.resolve(errorJson(500, 'Internal server error', '/x')),
    ],
  ])(
    '%s на удалении: исход неизвестен, предпросмотр сбрасывается',
    async (_name, failure) => {
      const preview = sampleResult({
        applied: false,
        total: { count: 1, bytes: 10 },
      });
      const { storage, fetchMock } = createStoreWithSession();
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve(jsonResponse(200, preview)),
        )
        .mockImplementationOnce(failure);

      await storage.preview();
      await storage.sweep();

      expect(storage.previewResult).toBeNull();
      expect(storage.outcome).toBeNull();
      expect(storage.messages).toContain(STORAGE_OUTCOME_UNKNOWN_MESSAGE);
      expect(storage.pending).toBe(false);
    },
  );

  it('401 с успешным refresh повторяет тот же POST один раз', async () => {
    const outcome = sampleResult({
      applied: true,
      total: { count: 1, bytes: 10 },
    });
    const preview = sampleResult({
      applied: false,
      total: { count: 1, bytes: 10 },
    });
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/auth/staff/refresh')) {
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: makeAccessToken({
              sub: 'sa-1',
              role: 'SUPER_ADMIN',
              type: 'staff',
            }),
            refreshToken: 'refresh-new',
          }),
        );
      }
      if (applyFlag(init) === false) {
        return Promise.resolve(jsonResponse(200, preview));
      }
      const applyCalls = fetchMock.mock.calls.filter(
        ([u, i]) =>
          String(u).includes('/storage/sweep') &&
          applyFlag(i as RequestInit | undefined),
      ).length;
      return Promise.resolve(
        applyCalls === 1
          ? errorJson(401, 'Unauthorized', '/storage/sweep')
          : jsonResponse(200, outcome),
      );
    });

    await storage.preview();
    await storage.sweep();

    expect(storage.outcome).toEqual(outcome);
    const sweepApplies = fetchMock.mock.calls.filter(
      ([u, i]) =>
        String(u).includes('/storage/sweep') &&
        applyFlag(i as RequestInit | undefined),
    );
    expect(sweepApplies).toHaveLength(2);
  });

  it('начало новой проверки очищает прошлый итог, неудача его не возвращает', async () => {
    const outcome = sampleResult({
      applied: true,
      total: { count: 1, bytes: 10 },
      failed: 1,
    });
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse(
            200,
            sampleResult({ applied: false, total: { count: 1, bytes: 10 } }),
          ),
        ),
      )
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, outcome)))
      .mockImplementationOnce(() =>
        Promise.resolve(
          errorJson(409, 'Storage sweep is already running', '/x'),
        ),
      );
    await storage.preview();
    await storage.sweep();

    await storage.preview();

    expect(storage.outcome).toBeNull();
    expect(storage.messages).toEqual(['Storage sweep is already running']);
  });

  it('discard отбрасывает ответ идущего запроса', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const pending = storage.preview();
    storage.discard();
    resolveFetch(jsonResponse(200, sampleResult({ applied: false })));
    await pending;

    expect(storage.previewResult).toBeNull();
    expect(storage.pending).toBe(false);
  });

  it('ответ неожиданной формы не становится предпросмотром', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { applied: false })),
    );

    await storage.preview();

    expect(storage.previewResult).toBeNull();
    expect(storage.messages).toEqual(['Неожиданный ответ очистки хранилища']);
  });

  it('отрицательные и дробные числа в ответе отвергаются', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(200, sampleResult({ total: { count: -1, bytes: 1.5 } })),
      ),
    );

    await storage.preview();

    expect(storage.previewResult).toBeNull();
  });

  it('ответ с applied, не совпадающим с запросом, отбрасывается', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, sampleResult({ applied: true }))),
    );

    await storage.preview();

    expect(storage.previewResult).toBeNull();
    expect(storage.messages).toEqual(['Неожиданный ответ очистки хранилища']);
  });

  it('нечитаемый 200 на удалении: исход неизвестен, предпросмотр сбрасывается', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse(
            200,
            sampleResult({ applied: false, total: { count: 1, bytes: 10 } }),
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(new Response('<html>', { status: 200 })),
      );

    await storage.preview();
    await storage.sweep();

    expect(storage.previewResult).toBeNull();
    expect(storage.messages).toContain(STORAGE_OUTCOME_UNKNOWN_MESSAGE);
  });

  it('уход со страницы во время проверки отбрасывает её ответ', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const pending = storage.preview();
    storage.reset();
    resolveFetch(jsonResponse(200, sampleResult({ applied: false })));
    await pending;

    expect(storage.previewResult).toBeNull();
    expect(storage.pending).toBe(false);
  });

  it('новый запрос очищает прежний итог, отказ 409 его не возвращает', async () => {
    const outcome = sampleResult({
      applied: true,
      total: { count: 1, bytes: 10 },
      failed: 1,
    });
    const preview = sampleResult({
      applied: false,
      total: { count: 1, bytes: 10 },
    });
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, preview)))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, outcome)))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, preview)))
      .mockImplementationOnce(() =>
        Promise.resolve(
          errorJson(409, 'Storage sweep is already running', '/x'),
        ),
      );
    await storage.preview();
    await storage.sweep();
    await storage.preview();
    expect(storage.outcome).toBeNull();

    await storage.sweep();

    expect(storage.outcome).toBeNull();
    expect(storage.messages).toEqual(['Storage sweep is already running']);
    expect(storage.previewResult).toEqual(preview);
  });

  it.each([400, 429])(
    '%i на удалении — определённый отказ, предпросмотр остаётся',
    async (status) => {
      const preview = sampleResult({
        applied: false,
        total: { count: 1, bytes: 10 },
      });
      const { storage, fetchMock } = createStoreWithSession();
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve(jsonResponse(200, preview)),
        )
        .mockImplementationOnce(() =>
          Promise.resolve(errorJson(status, 'Refused', '/x')),
        );
      await storage.preview();
      await storage.sweep();

      expect(storage.previewResult).toEqual(preview);
      expect(storage.messages).not.toContain(STORAGE_OUTCOME_UNKNOWN_MESSAGE);
    },
  );

  it.each([404, 408, 413])(
    '%i на удалении — исход неизвестен',
    async (status) => {
      const { storage, fetchMock } = createStoreWithSession();
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve(
            jsonResponse(
              200,
              sampleResult({ applied: false, total: { count: 1, bytes: 10 } }),
            ),
          ),
        )
        .mockImplementationOnce(() =>
          Promise.resolve(errorJson(status, 'Refused', '/x')),
        );
      await storage.preview();
      await storage.sweep();

      expect(storage.previewResult).toBeNull();
      expect(storage.messages).toContain(STORAGE_OUTCOME_UNKNOWN_MESSAGE);

      storage.reset();

      expect(storage.messages).toContain(STORAGE_OUTCOME_UNKNOWN_MESSAGE);
    },
  );

  it('discard во время удаления оставляет пометку неизвестного исхода', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse(
          200,
          sampleResult({ applied: false, total: { count: 1, bytes: 10 } }),
        ),
      ),
    );
    await storage.preview();
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    void storage.sweep();

    storage.discard();

    expect(storage.pending).toBe(false);
    expect(storage.messages).toEqual([STORAGE_OUTCOME_UNKNOWN_MESSAGE]);

    storage.reset();

    expect(storage.messages).toEqual([STORAGE_OUTCOME_UNKNOWN_MESSAGE]);
  });

  it('при 403 вызов падает в сообщения, refresh остаётся, refresh не вызывается', async () => {
    const { storage, fetchMock, storageSession, session } =
      createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorJson(403, 'Forbidden resource', '/storage/sweep')),
    );

    await storage.preview();

    expect(storage.messages).toEqual(['Forbidden resource']);
    expect(storage.previewResult).toBeNull();
    expect(storage.pending).toBe(false);
    expect(session.accessToken).not.toBeNull();
    expect(storageSession.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });

  it('при 409 вызов падает в сообщения, предпросмотр для повтора остаётся, автоповтора нет', async () => {
    const preview = sampleResult({
      applied: false,
      total: { count: 1, bytes: 10 },
    });
    const { storage, fetchMock, storageSession } = createStoreWithSession();
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, preview)))
      .mockImplementationOnce(() =>
        Promise.resolve(
          errorJson(409, 'Storage sweep is already running', '/storage/sweep'),
        ),
      );

    await storage.preview();
    await storage.sweep();

    expect(storage.messages).toEqual(['Storage sweep is already running']);
    expect(storage.outcome).toBeNull();
    expect(storage.previewResult).toEqual(preview);
    expect(storage.pending).toBe(false);
    expect(storageSession.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchUrl(fetchMock, 1)).not.toContain('/auth/staff/refresh');
  });

  it('пустой 200 не становится предпросмотром', async () => {
    const { storage, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    await storage.preview();

    expect(storage.previewResult).toBeNull();
    expect(storage.messages).toEqual(['Неожиданный ответ очистки хранилища']);
    expect(storage.pending).toBe(false);
  });
});

function createStoreWithSession(): {
  storage: StorageStore;
  fetchMock: ReturnType<typeof vi.fn>;
  storageSession: SessionStorage;
  session: SessionStore;
} {
  const storageSession = createMemoryStorage();
  const session = new SessionStore(storageSession);
  session.setPair(
    makeAccessToken({ sub: 'sa-1', role: 'SUPER_ADMIN', type: 'staff' }),
    'refresh-keep',
    'sa@example.com',
  );
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return {
    storage: new StorageStore(session.api),
    fetchMock,
    storageSession,
    session,
  };
}

function sampleResult(
  overrides: Partial<StorageSweepResult> = {},
): StorageSweepResult {
  return {
    applied: false,
    byPrefix: [
      { prefix: 'images', count: 0, bytes: 0 },
      { prefix: 'audio', count: 0, bytes: 0 },
      { prefix: 'video', count: 0, bytes: 0 },
    ],
    total: { count: 0, bytes: 0 },
    failed: 0,
    failedBytes: 0,
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
    timestamp: '2026-10-27T00:00:00.000Z',
  });
}

function fetchUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): string {
  return String(fetchMock.mock.calls[index]?.[0]);
}

function requestInit(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): RequestInit {
  return (fetchMock.mock.calls[index]?.[1] as RequestInit | undefined) ?? {};
}

function requestMethod(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): string | undefined {
  return requestInit(fetchMock, index).method;
}

function applyFlag(init: RequestInit | undefined): boolean {
  const body = init?.body;
  if (typeof body !== 'string') {
    throw new Error('Ожидалось строковое тело запроса');
  }
  const parsed = JSON.parse(body) as { apply?: unknown };
  if (typeof parsed.apply !== 'boolean') {
    throw new Error('Ожидался boolean apply');
  }
  return parsed.apply;
}

function requestBody(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): Record<string, unknown> {
  const body = requestInit(fetchMock, index).body;
  if (typeof body !== 'string') {
    throw new Error('Ожидалось строковое тело запроса');
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function createMemoryStorage(
  initial: Record<string, string> = {},
): SessionStorage {
  const entries = new Map(Object.entries(initial));
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
}
