import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../api/api-base-url.ts';
import type { CompositionNote } from '../stores/compositions-store.ts';
import { makeAccessToken } from '../stores/make-access-token.ts';
import { RootStore } from '../stores/root-store.ts';
import type { SessionStorage } from '../stores/session-store.ts';
import { AppProviders } from './App.tsx';
import { routes } from './routes.tsx';

vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: () => undefined,
      destroy: () => undefined,
    }),
  },
}));

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const NOTE_A = '22222222-2222-2222-2222-222222222222';
const NOTE_B = '33333333-3333-3333-3333-333333333333';
const NOTE_C = '44444444-4444-4444-4444-444444444444';
const NOTE_NEW = '55555555-5555-5555-5555-555555555555';

const MISMATCH =
  'noteIds must contain exactly the current set of note ids, without duplicates, omissions or unknown ids';

const INCOMPLETE =
  'Translations must include exactly one entry per locale (ru, en), without duplicates';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('список заметок на карточке', () => {
  it('берёт начальный список из full и не вызывает GET .../notes на маунте', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        notes: [
          sampleNote({
            id: NOTE_A,
            order: 0,
            translations: [
              { locale: 'en', text: 'English fact' },
              { locale: 'ru', text: 'Русский факт' },
            ],
          }),
        ],
      }),
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByTestId(`note-text-ru-${NOTE_A}`).textContent).toBe(
        'Русский факт',
      );
    });
    expect(screen.getByTestId(`note-text-en-${NOTE_A}`).textContent).toBe(
      'English fact',
    );
    expect(noteGets(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
    expect(
      screen
        .getByTestId('images-block')
        .compareDocumentPosition(screen.getByTestId('notes-block')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'А знали ли Вы?' }),
    ).toBeTruthy();
  });

  it('пустой массив из full рисует пустое состояние и не читает notes', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull({ notes: [] }) });
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Заметок нет')).toBeTruthy();
    });
    expect(noteGets(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
  });
});

describe('создание и правка заметки', () => {
  it('пустой текст en при заполненном ru не вызывает fetch', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull() });
    renderCard();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Создать' })).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Текст (ru)'), {
      target: { value: 'Только русский' },
    });
    submitDialog('Создать');

    expect(screen.getByText('Укажите текст (en)')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(notePosts(fetchMock)).toHaveLength(0);
  });

  it('пустой текст ru при заполненном en не вызывает fetch', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull() });
    renderCard();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Создать' })).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Текст (en)'), {
      target: { value: 'English only' },
    });
    submitDialog('Создать');

    expect(screen.getByText('Укажите текст (ru)')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(notePosts(fetchMock)).toHaveLength(0);
  });

  it('создание шлёт две локали с полем text и не шлёт name', async () => {
    const created = sampleNote({
      id: NOTE_NEW,
      order: 0,
      translations: [
        { locale: 'ru', text: 'Новый факт' },
        { locale: 'en', text: 'New fact' },
      ],
    });
    const fetchMock = stubCardFetch({
      full: sampleFull(),
      createBody: created,
      listBody: [created],
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Заметок нет')).toBeTruthy();
    });

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Текст (ru)'), {
      target: { value: 'Новый факт' },
    });
    fireEvent.change(screen.getByLabelText('Текст (en)'), {
      target: { value: 'New fact' },
    });
    submitDialog('Создать');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByTestId(`note-text-ru-${NOTE_NEW}`).textContent).toBe(
      'Новый факт',
    );
    expect(screen.getByTestId(`note-text-en-${NOTE_NEW}`).textContent).toBe(
      'New fact',
    );

    const post = notePosts(fetchMock)[0];
    if (post === undefined) {
      throw new Error('нет POST .../notes');
    }
    const body = requestJson(post);
    expect(body).toEqual({
      translations: [
        { locale: 'ru', text: 'Новый факт' },
        { locale: 'en', text: 'New fact' },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('"name"');
    expect(String(post[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes`,
    );
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('правка одного текста шлёт и ru, и en', async () => {
    const initial = sampleNote({
      id: NOTE_A,
      translations: [
        { locale: 'en', text: 'Keep me' },
        { locale: 'ru', text: 'Старый' },
      ],
    });
    const updated = sampleNote({
      id: NOTE_A,
      translations: [
        { locale: 'ru', text: 'Новый' },
        { locale: 'en', text: 'Keep me' },
      ],
    });
    const fetchMock = stubCardFetch({
      full: sampleFull({ notes: [initial] }),
      updateBody: updated,
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByTestId(`note-text-ru-${NOTE_A}`).textContent).toBe(
        'Старый',
      );
    });

    fireEvent.click(
      screen.getByRole('button', { name: `Изменить заметку ${NOTE_A}` }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      (within(dialog).getByLabelText('Текст (ru)') as HTMLInputElement).value,
    ).toBe('Старый');
    expect(
      (within(dialog).getByLabelText('Текст (en)') as HTMLInputElement).value,
    ).toBe('Keep me');
    fireEvent.change(within(dialog).getByLabelText('Текст (ru)'), {
      target: { value: 'Новый' },
    });
    submitDialog('Сохранить');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByTestId(`note-text-ru-${NOTE_A}`).textContent).toBe(
      'Новый',
    );
    expect(screen.getByTestId(`note-text-en-${NOTE_A}`).textContent).toBe(
      'Keep me',
    );

    const patch = notePatches(fetchMock)[0];
    if (patch === undefined) {
      throw new Error('нет PATCH .../notes/:noteId');
    }
    expect(String(patch[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes/${NOTE_A}`,
    );
    expect(requestJson(patch)).toEqual({
      translations: [
        { locale: 'ru', text: 'Новый' },
        { locale: 'en', text: 'Keep me' },
      ],
    });
    expect(JSON.stringify(requestJson(patch))).not.toContain('"name"');
    expect(orderPatches(fetchMock)).toHaveLength(0);
  });

  it('400 создания показывает message и оставляет диалог открытым', async () => {
    stubCardFetch({
      full: sampleFull(),
      createStatus: 400,
      createMessage: INCOMPLETE,
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Создать' })).toBeTruthy();
    });
    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Текст (ru)'), {
      target: { value: 'Факт' },
    });
    fireEvent.change(screen.getByLabelText('Текст (en)'), {
      target: { value: 'Fact' },
    });
    submitDialog('Создать');

    await waitFor(() => {
      expect(screen.getByText(INCOMPLETE)).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('Войти')).toBeNull();
  });
});

describe('порядок заметок', () => {
  it('кнопка «ниже» шлёт полный noteIds на .../notes/order', async () => {
    const initial = [
      sampleNote({ id: NOTE_A, order: 0, translations: pair('А', 'A') }),
      sampleNote({ id: NOTE_B, order: 1, translations: pair('Б', 'B') }),
      sampleNote({ id: NOTE_C, order: 2, translations: pair('В', 'C') }),
    ];
    const reordered = [
      sampleNote({ id: NOTE_B, order: 0, translations: pair('Б', 'B') }),
      sampleNote({ id: NOTE_A, order: 1, translations: pair('А', 'A') }),
      sampleNote({ id: NOTE_C, order: 2, translations: pair('В', 'C') }),
    ];
    const fetchMock = stubCardFetch({
      full: sampleFull({ notes: initial }),
      orderBody: reordered,
    });
    renderCard();

    await waitFor(() => {
      expect(noteIdsOnScreen()).toEqual([NOTE_A, NOTE_B, NOTE_C]);
    });
    expect(orderPatches(fetchMock)).toHaveLength(0);
    expect(
      (
        screen.getByRole('button', {
          name: `Выше ${NOTE_A}`,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: `Ниже ${NOTE_C}`,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: `Ниже ${NOTE_A}` }));

    await waitFor(() => {
      expect(orderPatches(fetchMock)).toHaveLength(1);
    });
    const patch = orderPatches(fetchMock)[0];
    if (patch === undefined) {
      throw new Error('нет PATCH .../notes/order');
    }
    expect(new URL(String(patch[0])).pathname).toBe(
      `/compositions/${COMPOSITION_ID}/notes/order`,
    );
    const body = requestJson(patch) as { noteIds: string[] };
    expect(body).toEqual({
      noteIds: [NOTE_B, NOTE_A, NOTE_C],
    });
    expect(body.noteIds).toHaveLength(initial.length);
    expect(new Set(body.noteIds)).toEqual(
      new Set(initial.map((note) => note.id)),
    );
    await waitFor(() => {
      expect(noteIdsOnScreen()).toEqual([NOTE_B, NOTE_A, NOTE_C]);
    });
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('крайняя позиция и пустой набор не отправляют noteIds', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        notes: [sampleNote({ id: NOTE_A })],
      }),
    });
    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: `Ниже ${NOTE_A}` }),
      ).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: `Выше ${NOTE_A}` }));
    fireEvent.click(screen.getByRole('button', { name: `Ниже ${NOTE_A}` }));

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(orderPatches(fetchMock)).toHaveLength(0);
  });

  it('400 несовпадения набора показывает message и не чистит сессию', async () => {
    const initial = [
      sampleNote({ id: NOTE_A, order: 0 }),
      sampleNote({ id: NOTE_B, order: 1 }),
    ];
    stubCardFetch({
      full: sampleFull({ notes: initial }),
      orderStatus: 400,
      orderMessage: MISMATCH,
    });
    renderCard();

    await waitFor(() => {
      expect(noteIdsOnScreen()).toEqual([NOTE_A, NOTE_B]);
    });
    fireEvent.click(screen.getByRole('button', { name: `Ниже ${NOTE_A}` }));

    await waitFor(() => {
      expect(screen.getByText(MISMATCH)).toBeTruthy();
    });
    expect(noteIdsOnScreen()).toEqual([NOTE_A, NOTE_B]);
    expect(screen.queryByText('Войти')).toBeNull();
  });
});

describe('удаление заметки', () => {
  it('согласие вызывает DELETE с noteId и убирает строку при 204', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        notes: [
          sampleNote({
            id: NOTE_A,
            translations: pair('Удалить меня', 'Delete me'),
          }),
        ],
      }),
    });
    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: `Удалить заметку ${NOTE_A}` }),
      ).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить заметку ${NOTE_A}` }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/безвозвратно/)).toBeTruthy();
    expect(within(dialog).getByText('Удалить меня')).toBeTruthy();
    expect(within(dialog).getByText('Delete me')).toBeTruthy();
    expect(noteDeletes(fetchMock)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(screen.queryByTestId(`note-text-ru-${NOTE_A}`)).toBeNull();
    });
    expect(screen.getByText('Заметок нет')).toBeTruthy();
    const deletion = noteDeletes(fetchMock);
    expect(deletion).toHaveLength(1);
    const deletionCall = deletion[0];
    if (deletionCall === undefined) {
      throw new Error('нет DELETE .../notes/:noteId');
    }
    expect(String(deletionCall[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/notes/${NOTE_A}`,
    );
    expect(String(deletionCall[0])).not.toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
    expect((deletionCall[1] as RequestInit).method).toBe('DELETE');
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('отмена удаления не вызывает fetch', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ notes: [sampleNote({ id: NOTE_A })] }),
    });
    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: `Удалить заметку ${NOTE_A}` }),
      ).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить заметку ${NOTE_A}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(noteDeletes(fetchMock)).toHaveLength(0);
    expect(screen.getByTestId(`note-text-ru-${NOTE_A}`)).toBeTruthy();
  });

  it('404 удаления показывает message', async () => {
    stubCardFetch({
      full: sampleFull({ notes: [sampleNote({ id: NOTE_A })] }),
      deleteStatus: 404,
      deleteMessage: 'Not Found',
      listBody: [sampleNote({ id: NOTE_A })],
    });
    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: `Удалить заметку ${NOTE_A}` }),
      ).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить заметку ${NOTE_A}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(screen.getByText('Not Found')).toBeTruthy();
    });
    expect(screen.getByTestId(`note-text-ru-${NOTE_A}`)).toBeTruthy();
    expect(screen.queryByText('Войти')).toBeNull();
  });
});

function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
}

function submitDialog(name: string) {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name }));
}

function noteIdsOnScreen(): string[] {
  return [...document.querySelectorAll('[data-note-id]')].map(
    (node) => node.getAttribute('data-note-id') ?? '',
  );
}

function renderCard() {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, {
    initialEntries: [`/compositions/${COMPOSITION_ID}`],
  });
  return render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

function stubCardFetch({
  full,
  createStatus = 201,
  createMessage,
  createBody = null,
  updateStatus = 200,
  updateMessage,
  updateBody = null,
  listBody = [],
  orderStatus = 200,
  orderMessage,
  orderBody = [],
  deleteStatus = 204,
  deleteMessage,
}: {
  full: ReturnType<typeof sampleFull>;
  createStatus?: number;
  createMessage?: string;
  createBody?: unknown;
  updateStatus?: number;
  updateMessage?: string;
  updateBody?: unknown;
  listBody?: unknown;
  orderStatus?: number;
  orderMessage?: string;
  orderBody?: unknown;
  deleteStatus?: number;
  deleteMessage?: string;
}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const parsed = new URL(String(url));
    const method = init?.method ?? 'GET';
    const pathname = parsed.pathname;

    if (pathname.endsWith('/tags') && method === 'GET') {
      return Promise.resolve(
        jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
      );
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/full` &&
      method === 'GET'
    ) {
      return Promise.resolve(jsonResponse(200, full));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/notes` &&
      method === 'POST'
    ) {
      if (createStatus >= 400) {
        return Promise.resolve(
          errorJson(createStatus, createMessage ?? 'Error', pathname),
        );
      }
      return Promise.resolve(jsonResponse(201, createBody));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/notes` &&
      method === 'GET'
    ) {
      return Promise.resolve(jsonResponse(200, listBody));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/notes/order` &&
      method === 'PATCH'
    ) {
      if (orderStatus >= 400) {
        return Promise.resolve(
          errorJson(orderStatus, orderMessage ?? 'Error', pathname),
        );
      }
      return Promise.resolve(jsonResponse(200, orderBody));
    }
    if (
      pathname.startsWith(`/compositions/${COMPOSITION_ID}/notes/`) &&
      method === 'PATCH'
    ) {
      if (updateStatus >= 400) {
        return Promise.resolve(
          errorJson(updateStatus, updateMessage ?? 'Error', pathname),
        );
      }
      return Promise.resolve(jsonResponse(200, updateBody));
    }
    if (
      pathname.startsWith(`/compositions/${COMPOSITION_ID}/notes/`) &&
      method === 'DELETE'
    ) {
      if (deleteStatus === 204) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(
        errorJson(deleteStatus, deleteMessage ?? 'Error', pathname),
      );
    }
    return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sampleFull(
  overrides: {
    notes?: CompositionNote[];
  } = {},
) {
  return {
    id: COMPOSITION_ID,
    title: 'Song One',
    author: 'Author',
    status: 'DRAFT' as const,
    createdById: 'admin-1',
    tags: [],
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    originalAudioUrl: null,
    originalAudioDurationSec: null,
    clips: [],
    images: [],
    notes: overrides.notes ?? [],
  };
}

function pair(ru: string, en: string) {
  return [
    { locale: 'ru' as const, text: ru },
    { locale: 'en' as const, text: en },
  ];
}

function sampleNote(overrides: Partial<CompositionNote> = {}): CompositionNote {
  return {
    id: NOTE_A,
    translations: pair('Факт', 'Fact'),
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
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
    error: 'Error',
    path,
    timestamp: '2026-09-25T00:00:00.000Z',
  });
}

function requestJson(call: unknown[]): Record<string, unknown> {
  const init = call[1] as RequestInit | undefined;
  if (typeof init?.body !== 'string') {
    throw new Error('Ожидалось строковое тело запроса');
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

function callsBy(
  fetchMock: ReturnType<typeof vi.fn>,
  method: string,
  pathname: string,
) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    const actual = init?.method ?? 'GET';
    return actual === method && new URL(String(call[0])).pathname === pathname;
  });
}

function noteGets(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'GET', `/compositions/${COMPOSITION_ID}/notes`);
}

function notePosts(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'POST', `/compositions/${COMPOSITION_ID}/notes`);
}

function notePatches(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    const method = init?.method ?? 'GET';
    const pathname = new URL(String(call[0])).pathname;
    return (
      method === 'PATCH' &&
      pathname.startsWith(`/compositions/${COMPOSITION_ID}/notes/`) &&
      !pathname.endsWith('/order')
    );
  });
}

function orderPatches(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(
    fetchMock,
    'PATCH',
    `/compositions/${COMPOSITION_ID}/notes/order`,
  );
}

function noteDeletes(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    const method = init?.method ?? 'GET';
    const pathname = new URL(String(call[0])).pathname;
    return (
      method === 'DELETE' &&
      pathname.startsWith(`/compositions/${COMPOSITION_ID}/notes/`)
    );
  });
}

function fullGets(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'GET', `/compositions/${COMPOSITION_ID}/full`);
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
