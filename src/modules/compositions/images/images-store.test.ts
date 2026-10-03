import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../../../shared/api/api-base-url.ts';
import { ApiError } from '../../../shared/api/api-error.ts';
import {
  ImagesStore,
  MAX_IMAGE_FILES,
  type CompositionImage,
} from './images-store.ts';
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
const IMAGE_A = '22222222-2222-2222-2222-222222222222';
const IMAGE_B = '33333333-3333-3333-3333-333333333333';
const IMAGE_C = '44444444-4444-4444-4444-444444444444';

const MISMATCH =
  'imageIds must contain exactly the current set of composition image ids, without duplicates, omissions or unknown ids';

describe('ImagesStore', () => {
  it('загрузка шлёт multipart с полем files и без Content-Type: application/json', async () => {
    const uploaded = [
      sampleImage({ id: IMAGE_A, order: 0 }),
      sampleImage({
        id: IMAGE_B,
        order: 1,
        fileUrl: 'https://example.com/b.png',
      }),
    ];
    const { images, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, uploaded, 201);
    const first = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const second = new File(['b'], 'b.png', { type: 'image/png' });

    await expect(
      images.uploadImages(COMPOSITION_ID, [first, second]),
    ).resolves.toEqual(uploaded);

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/images`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('POST');
    const body = requestInit(fetchMock, 0).body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.getAll('files')).toEqual([first, second]);
    expect(form.has('file')).toBe(false);
    expect(requestHeaders(fetchMock, 0).get('Content-Type')).toBeNull();
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
    expect(uploaded[0]?.fileUrl).toBe('https://example.com/a.jpg');
  });

  it('0 файлов и больше 10 не вызывают fetch', async () => {
    const { images, fetchMock } = createStoreWithSession();
    const tooMany = Array.from(
      { length: MAX_IMAGE_FILES + 1 },
      (_, index) =>
        new File(['x'], `f${String(index)}.jpg`, { type: 'image/jpeg' }),
    );

    await expect(
      images.uploadImages(COMPOSITION_ID, []),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      images.uploadImages(COMPOSITION_ID, tooMany),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('список читает GET .../images', async () => {
    const listed = [sampleImage()];
    const { images, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, listed);

    await expect(images.listImages(COMPOSITION_ID)).resolves.toEqual(listed);
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/images`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('GET');
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
  });

  it('порядок шлёт полный imageIds на .../images/order', async () => {
    const next = [
      sampleImage({ id: IMAGE_C, order: 0 }),
      sampleImage({ id: IMAGE_A, order: 1 }),
      sampleImage({ id: IMAGE_B, order: 2 }),
    ];
    const ids = [IMAGE_C, IMAGE_A, IMAGE_B];
    const { images, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, next);

    await expect(images.reorderImages(COMPOSITION_ID, ids)).resolves.toEqual(
      next,
    );

    expect(requestMethod(fetchMock, 0)).toBe('PATCH');
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/images/order`,
    );
    expect(requestJson(fetchMock, 0)).toEqual({ imageIds: ids });
    expect(requestHeaders(fetchMock, 0).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('пустой imageIds не вызывает fetch', async () => {
    const { images, fetchMock } = createStoreWithSession();

    await expect(
      images.reorderImages(COMPOSITION_ID, []),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DELETE 204 без тела завершается undefined', async () => {
    const { images, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(
      images.removeImage(COMPOSITION_ID, IMAGE_A),
    ).resolves.toBeUndefined();

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/images/${IMAGE_A}`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('DELETE');
    expect(fetchUrl(fetchMock, 0)).not.toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
  });

  it('400, 413 и 415 пробрасывают message, refresh остаётся', async () => {
    const { images, fetchMock, storage } = createStoreWithSession();
    const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' });
    const cases: {
      status: number;
      message: string;
      path: string;
      run: () => Promise<unknown>;
    }[] = [
      {
        status: 400,
        message: 'files is required',
        path: `/compositions/${COMPOSITION_ID}/images`,
        run: () => images.uploadImages(COMPOSITION_ID, [file]),
      },
      {
        status: 400,
        message: 'Unexpected field - files',
        path: `/compositions/${COMPOSITION_ID}/images`,
        run: () => images.uploadImages(COMPOSITION_ID, [file]),
      },
      {
        status: 400,
        message: MISMATCH,
        path: `/compositions/${COMPOSITION_ID}/images/order`,
        run: () => images.reorderImages(COMPOSITION_ID, [IMAGE_A]),
      },
      {
        status: 413,
        message: 'File too large',
        path: `/compositions/${COMPOSITION_ID}/images`,
        run: () => images.uploadImages(COMPOSITION_ID, [file]),
      },
      {
        status: 415,
        message: 'Unsupported or disallowed file type',
        path: `/compositions/${COMPOSITION_ID}/images`,
        run: () => images.uploadImages(COMPOSITION_ID, [file]),
      },
    ];

    for (const item of cases) {
      fetchMock.mockClear();
      fetchMock.mockImplementation(() =>
        Promise.resolve(errorJson(item.status, item.message, item.path)),
      );

      await expect(item.run()).rejects.toMatchObject({
        status: item.status,
        messages: [item.message],
        message: item.message,
      });

      expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchUrl(fetchMock, 0)).not.toContain('/auth/staff/refresh');
    }
  });
});

function createStoreWithSession(): {
  images: ImagesStore;
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
    images: new ImagesStore(session.api),
    fetchMock,
    storage,
  };
}

function sampleImage(
  overrides: Partial<CompositionImage> = {},
): CompositionImage {
  return {
    id: IMAGE_A,
    fileUrl: 'https://example.com/a.jpg',
    order: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
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
    timestamp: '2026-09-25T00:00:00.000Z',
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

function requestJson(
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
