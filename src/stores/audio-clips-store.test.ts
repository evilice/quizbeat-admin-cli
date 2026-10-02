import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../api/api-base-url.ts';
import { ApiError } from '../api/api-error.ts';
import { AudioClipsStore, type AudioClipPoint } from './audio-clips-store.ts';
import type { AudioClip } from './compositions-store.ts';
import { makeAccessToken } from './make-access-token.ts';
import {
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from './session-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const CLIP_ID = '22222222-2222-2222-2222-222222222222';

const POINT: AudioClipPoint = {
  startTimeSec: 4,
  durationSec: 5,
  difficulty: 'MEDIUM',
};

describe('AudioClipsStore', () => {
  it('загрузка шлёт multipart с полем file и без Content-Type: application/json', async () => {
    const { audioClips, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, { originalAudioDurationSec: 180 }, 201);
    const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });

    await expect(audioClips.uploadAudio(COMPOSITION_ID, file)).resolves.toEqual(
      { originalAudioDurationSec: 180 },
    );

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/audio`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('POST');
    const body = requestInit(fetchMock, 0).body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('file')).toBe(file);
    expect(form.has('files')).toBe(false);
    expect(requestHeaders(fetchMock, 0).get('Content-Type')).toBeNull();
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
  });

  it('создание шлёт JSON { points } с целым стартом, допустимой длительностью и сложностью', async () => {
    const created = [sampleClip({ status: 'PENDING' })];
    delete created[0]?.fileUrl;
    const { audioClips, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, created, 201);

    const result = await audioClips.createClips(COMPOSITION_ID, [
      { startTimeSec: 4.9, durationSec: 5, difficulty: 'HARD' },
    ]);

    expect(requestMethod(fetchMock, 0)).toBe('POST');
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/clips`,
    );
    expect(requestJson(fetchMock, 0)).toEqual({
      points: [{ startTimeSec: 4, durationSec: 5, difficulty: 'HARD' }],
    });
    expect(result[0]).not.toHaveProperty('fileUrl');
    expect(requestHeaders(fetchMock, 0).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('пустой points не вызывает fetch', async () => {
    const { audioClips, fetchMock } = createStoreWithSession();

    await expect(
      audioClips.createClips(COMPOSITION_ID, []),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('список и 201 без fileUrl не дополняют поле', async () => {
    const pending = sampleClip({ status: 'PENDING' });
    delete pending.fileUrl;
    const { audioClips, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, [pending]);

    const listed = await audioClips.listClips(COMPOSITION_ID);

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/clips`,
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty('fileUrl');
    expect(listed[0]?.status).toBe('PENDING');
  });

  it('DELETE 204 без тела завершается undefined', async () => {
    const { audioClips, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(
      audioClips.removeClip(COMPOSITION_ID, CLIP_ID),
    ).resolves.toBeUndefined();

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/clips/${CLIP_ID}`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('DELETE');
    expect(fetchUrl(fetchMock, 0)).not.toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
  });

  it('перегенерация — POST без тела точек', async () => {
    const pending = sampleClip({ status: 'PENDING' });
    delete pending.fileUrl;
    const { audioClips, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, pending);

    await expect(
      audioClips.regenerateClip(COMPOSITION_ID, CLIP_ID),
    ).resolves.toEqual(pending);

    expect(requestMethod(fetchMock, 0)).toBe('POST');
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/clips/${CLIP_ID}/regenerate`,
    );
    expect(requestInit(fetchMock, 0).body).toBeUndefined();
    expect(pending).not.toHaveProperty('fileUrl');
  });

  it('409, 400, 415 и 413 пробрасывают message, refresh остаётся', async () => {
    const { audioClips, fetchMock, storage } = createStoreWithSession();
    const cases: {
      status: number;
      message: string;
      path: string;
      run: () => Promise<unknown>;
    }[] = [
      {
        status: 409,
        message: 'Audio clip is already pending or being processed',
        path: `/compositions/${COMPOSITION_ID}/clips/${CLIP_ID}/regenerate`,
        run: () => audioClips.regenerateClip(COMPOSITION_ID, CLIP_ID),
      },
      {
        status: 400,
        message: 'Point is out of the original audio track duration range',
        path: `/compositions/${COMPOSITION_ID}/clips`,
        run: () => audioClips.createClips(COMPOSITION_ID, [POINT]),
      },
      {
        status: 415,
        message: 'Unsupported or disallowed file type',
        path: `/compositions/${COMPOSITION_ID}/audio`,
        run: () =>
          audioClips.uploadAudio(
            COMPOSITION_ID,
            new File(['x'], 'track.mp3', { type: 'audio/mpeg' }),
          ),
      },
      {
        status: 413,
        message: 'File too large',
        path: `/compositions/${COMPOSITION_ID}/audio`,
        run: () =>
          audioClips.uploadAudio(
            COMPOSITION_ID,
            new File(['x'], 'track.mp3', { type: 'audio/mpeg' }),
          ),
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

  it('404 на ссылку оригинала — ошибка вызывающему, refresh остаётся', async () => {
    const { audioClips, fetchMock, storage } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        errorJson(404, 'Not Found', `/compositions/${COMPOSITION_ID}/audio`),
      ),
    );

    await expect(audioClips.getAudioUrl(COMPOSITION_ID)).rejects.toMatchObject({
      status: 404,
      messages: ['Not Found'],
    });
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-keep');
  });
});

function createStoreWithSession(): {
  audioClips: AudioClipsStore;
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
    audioClips: new AudioClipsStore(session.api),
    fetchMock,
    storage,
  };
}

function sampleClip(overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id: CLIP_ID,
    difficulty: 'EASY',
    durationSec: 5,
    startTimeSec: 4,
    status: 'DONE',
    fileUrl: 'https://example.com/clip.mp3',
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
