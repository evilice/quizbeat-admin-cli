import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../../../shared/api/api-base-url.ts';
import { ApiError } from '../../../shared/api/api-error.ts';
import { makeAccessToken } from '../../../shared/testing/make-access-token.ts';
import {
  NotesStore,
  type CompositionNote,
  type NoteTranslation,
} from './notes-store.ts';
import {
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from '../../../modules/session/session-store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const NOTE_A = '22222222-2222-2222-2222-222222222222';
const NOTE_B = '33333333-3333-3333-3333-333333333333';
const NOTE_C = '44444444-4444-4444-4444-444444444444';

const BOTH: NoteTranslation[] = [
  { locale: 'ru', text: 'Привет' },
  { locale: 'en', text: 'Hello' },
];

const MISMATCH =
  'noteIds must contain exactly the current set of note ids, without duplicates, omissions or unknown ids';

const INCOMPLETE =
  'Translations must include exactly one entry per locale (ru, en), without duplicates';

describe('NotesStore', () => {
  it('создание шлёт translations массивом с locale и text, без name', async () => {
    const created = sampleNote();
    const { notes, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, created, 201);

    await expect(notes.createNote(COMPOSITION_ID, BOTH)).resolves.toEqual(
      created,
    );

    expect(requestMethod(fetchMock, 0)).toBe('POST');
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes`,
    );
    const body = requestJson(fetchMock, 0);
    expect(body).toEqual({ translations: BOTH });
    expect(Array.isArray(body.translations)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('"name"');
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
    expect(fetchUrl(fetchMock, 0)).not.toContain('/notes/');
  });

  it('правка на пути с uuid шлёт оба переданных перевода', async () => {
    const updated = sampleNote({
      translations: [
        { locale: 'ru', text: 'Новый' },
        { locale: 'en', text: 'Hello' },
      ],
    });
    const sent: NoteTranslation[] = [
      { locale: 'ru', text: 'Новый' },
      { locale: 'en', text: 'Hello' },
    ];
    const { notes, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, updated);

    await expect(
      notes.updateNote(COMPOSITION_ID, NOTE_A, sent),
    ).resolves.toEqual(updated);

    expect(requestMethod(fetchMock, 0)).toBe('PATCH');
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes/${NOTE_A}`,
    );
    expect(requestJson(fetchMock, 0)).toEqual({ translations: sent });
    expect(requestJson(fetchMock, 0).translations).toHaveLength(2);
    expect(fetchUrl(fetchMock, 0)).not.toContain('/notes/order');
  });

  it('список читает GET .../notes', async () => {
    const listed = [sampleNote()];
    const { notes, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, listed);

    await expect(notes.listNotes(COMPOSITION_ID)).resolves.toEqual(listed);
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('GET');
    expect(fetchUrl(fetchMock, 0)).not.toContain('/full');
  });

  it('порядок шлёт полный noteIds на .../notes/order', async () => {
    const next = [
      sampleNote({ id: NOTE_C, order: 0 }),
      sampleNote({ id: NOTE_A, order: 1 }),
      sampleNote({ id: NOTE_B, order: 2 }),
    ];
    const ids = [NOTE_C, NOTE_A, NOTE_B];
    const { notes, fetchMock } = createStoreWithSession();
    stubJsonOk(fetchMock, next);

    await expect(notes.reorderNotes(COMPOSITION_ID, ids)).resolves.toEqual(
      next,
    );

    expect(requestMethod(fetchMock, 0)).toBe('PATCH');
    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes/order`,
    );
    expect(fetchUrl(fetchMock, 0)).not.toContain(NOTE_A);
    expect(requestJson(fetchMock, 0)).toEqual({ noteIds: ids });
    expect(requestHeaders(fetchMock, 0).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('пустой noteIds не вызывает fetch', async () => {
    const { notes, fetchMock } = createStoreWithSession();

    await expect(notes.reorderNotes(COMPOSITION_ID, [])).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DELETE 204 без тела завершается undefined', async () => {
    const { notes, fetchMock } = createStoreWithSession();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(
      notes.removeNote(COMPOSITION_ID, NOTE_A),
    ).resolves.toBeUndefined();

    expect(fetchUrl(fetchMock, 0)).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes/${NOTE_A}`,
    );
    expect(requestMethod(fetchMock, 0)).toBe('DELETE');
    expect(fetchUrl(fetchMock, 0)).not.toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
  });

  it('400 и 404 пробрасывают message, refresh остаётся', async () => {
    const { notes, fetchMock, storage } = createStoreWithSession();
    const cases: {
      status: number;
      message: string;
      path: string;
      run: () => Promise<unknown>;
    }[] = [
      {
        status: 400,
        message: INCOMPLETE,
        path: `/compositions/${COMPOSITION_ID}/notes`,
        run: () => notes.createNote(COMPOSITION_ID, BOTH),
      },
      {
        status: 400,
        message: MISMATCH,
        path: `/compositions/${COMPOSITION_ID}/notes/order`,
        run: () => notes.reorderNotes(COMPOSITION_ID, [NOTE_A]),
      },
      {
        status: 404,
        message: 'Not Found',
        path: `/compositions/${COMPOSITION_ID}/notes/${NOTE_A}`,
        run: () => notes.removeNote(COMPOSITION_ID, NOTE_A),
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
  notes: NotesStore;
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
    notes: new NotesStore(session.api),
    fetchMock,
    storage,
  };
}

function sampleNote(overrides: Partial<CompositionNote> = {}): CompositionNote {
  return {
    id: NOTE_A,
    translations: BOTH,
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
