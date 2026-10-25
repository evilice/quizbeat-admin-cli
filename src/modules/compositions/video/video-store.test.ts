import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../../../shared/api/api-base-url.ts';
import { ApiError, messagesFromError } from '../../../shared/api/api-error.ts';
import { VideoStore } from './video-store.ts';
import { makeAccessToken } from '../../../shared/testing/make-access-token.ts';
import {
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from '../../../modules/session/session-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';

describe('VideoStore', () => {
  it('save шлёт один POST multipart с file, startSec и endSec и не запрашивает ссылку', async () => {
    const uploaded = { videoDurationSec: 2.48 };
    const { video, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, uploaded, 201);
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const endSec = 0.1 + 0.2;

    await expect(
      video.save(COMPOSITION_ID, file, 1.5, endSec),
    ).resolves.toEqual(uploaded);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/video`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('POST');
    const body = requestInit(fetchMock, 0).body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('file')).toEqual(file);
    expect(form.get('startSec')).toBe('1.5');
    expect(form.get('endSec')).toBe(String(endSec));
    expect(form.get('endSec')).not.toBe('0.30');
    expect(form.has('files')).toBe(false);
    expect(requestHeaders(fetchMock, 0).get('Content-Type')).toBeNull();
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
  });

  it('дробные границы уходят десятичной строкой без экспоненты и без округления', async () => {
    const { video, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, { videoDurationSec: 0.1 }, 201);
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });

    await video.save(COMPOSITION_ID, file, 1e-7, 1.5e1);

    const body = requestInit(fetchMock, 0).body as FormData;
    expect(body.get('startSec')).toBe('0.0000001');
    expect(body.get('endSec')).toBe('15');
    expect(String(1e-7)).toBe('1e-7');
  });

  it('пустой ответ save — ApiError, без повторного запроса', async () => {
    const { video, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 201 })),
    );

    await expect(
      video.save(
        COMPOSITION_ID,
        new File(['video'], 'clip.mp4', { type: 'video/mp4' }),
        0,
        1,
      ),
    ).rejects.toMatchObject({
      status: null,
      messages: ['Пустой ответ загрузки видео'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('getUrl возвращает строку url', async () => {
    const { video, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, { url: 'https://example.com/clip.mp4' });

    await expect(video.getUrl(COMPOSITION_ID)).resolves.toBe(
      'https://example.com/clip.mp4',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/video`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('GET');
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
  });

  it('404 на GET — видео нет, refresh остаётся', async () => {
    const { video, fetchMock, storage } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        errorJson(404, 'Not Found', `/compositions/${COMPOSITION_ID}/video`),
      ),
    );

    await expect(video.getUrl(COMPOSITION_ID)).resolves.toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
  });

  it('пустой ответ getUrl — ApiError', async () => {
    const { video, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    await expect(video.getUrl(COMPOSITION_ID)).rejects.toBeInstanceOf(ApiError);
    await expect(video.getUrl(COMPOSITION_ID)).rejects.toMatchObject({
      messages: ['Пустой ответ ссылки на видео'],
    });
  });

  it('DELETE 204 без тела завершается undefined', async () => {
    const { video, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(video.remove(COMPOSITION_ID)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/video`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('DELETE');
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
  });

  it('400, 413, 415 и 422 пробрасывают message как есть, запрос не повторяется', async () => {
    const { video, fetchMock, storage } = createStoreWithSession();
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const cases: {
      status: number;
      message: string;
      run: () => Promise<unknown>;
    }[] = [
      {
        status: 400,
        message: 'startSec must be less than endSec',
        run: () => video.save(COMPOSITION_ID, file, 4, 1),
      },
      {
        status: 400,
        message: 'file is required',
        run: () => video.save(COMPOSITION_ID, file, 0, 1),
      },
      {
        status: 400,
        message: 'The file does not contain a video stream',
        run: () => video.save(COMPOSITION_ID, file, 0, 1),
      },
      {
        status: 404,
        message: 'Not Found',
        run: () => video.save(COMPOSITION_ID, file, 0, 1),
      },
      {
        status: 413,
        message: 'File exceeds the maximum allowed size for this category',
        run: () => video.save(COMPOSITION_ID, file, 0, 1),
      },
      {
        status: 415,
        message: 'Unsupported or disallowed file type',
        run: () => video.save(COMPOSITION_ID, file, 0, 1),
      },
      {
        status: 422,
        message: 'Unable to trim the video',
        run: () => video.save(COMPOSITION_ID, file, 0, 1),
      },
      {
        status: 404,
        message: 'Not Found',
        run: () => video.remove(COMPOSITION_ID),
      },
      {
        status: 500,
        message: 'Internal server error',
        run: () => video.getUrl(COMPOSITION_ID),
      },
    ];

    for (const item of cases) {
      fetchMock.mockClear();
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          errorJson(
            item.status,
            item.message,
            `/compositions/${COMPOSITION_ID}/video`,
          ),
        ),
      );

      let caught: unknown;
      try {
        await item.run();
      } catch (error) {
        caught = error;
      }

      expect(caught).toMatchObject({
        status: item.status,
        messages: [item.message],
        message: item.message,
      });
      expect(messagesFromError(caught)).toEqual([item.message]);
      expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
    }
  });
});

function createStoreWithSession(): {
  video: VideoStore;
  fetchMock: ReturnType<typeof vi.fn>;
  storage: SessionStorage & { entries: Map<string, string> };
} {
  const storage = createMemoryStorage();
  const session = new SessionStore(storage);
  session.setPair(
    makeAccessToken({ sub: 'sa-1', role: 'SUPER_ADMIN', type: 'staff' }),
    'refresh-keep',
    'sa@example.com',
  );
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return {
    video: new VideoStore(session.api),
    fetchMock,
    storage,
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
    error: 'Error',
    path,
    timestamp: '2026-10-25T00:00:00.000Z',
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

function requestHeaders(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): Headers {
  return new Headers(requestInit(fetchMock, index).headers);
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
