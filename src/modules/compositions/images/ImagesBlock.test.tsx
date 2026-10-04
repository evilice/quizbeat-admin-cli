import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../../../shared/api/api-base-url.ts';
import type { CompositionImage } from './images-store.ts';
import { makeAccessToken } from '../../../shared/testing/make-access-token.ts';
import { RootStore } from '../../../shared/store/root-store.ts';
import type { SessionStorage } from '../../../modules/session/session-store.ts';
import { AppProviders } from '../../../app/App.tsx';
import { routes } from '../../../app/routes.tsx';

vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: () => undefined,
      destroy: () => undefined,
    }),
  },
}));

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const IMAGE_A = '22222222-2222-2222-2222-222222222222';
const IMAGE_B = '33333333-3333-3333-3333-333333333333';
const IMAGE_C = '44444444-4444-4444-4444-444444444444';
const IMAGE_D = '55555555-5555-5555-5555-555555555555';
const IMAGE_E = '66666666-6666-6666-6666-666666666666';
const FILE_URL_A = 'https://example.com/a.jpg';
const FILE_URL_B = 'https://example.com/b.png';
const FILE_URL_C = 'https://example.com/c.webp';
const FILE_URL_A_FRESH = 'https://example.com/a-fresh.jpg';
const FILE_URL_D = 'https://example.com/d.jpg';
const FILE_URL_E = 'https://example.com/e.png';
const MISMATCH =
  'imageIds must contain exactly the current set of composition image ids, without duplicates, omissions or unknown ids';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('изображения на карточке', () => {
  it('берёт начальный список из full и не вызывает GET .../images на маунте', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        images: [
          sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A, order: 0 }),
          sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 1 }),
        ],
      }),
    });
    await renderCard();

    await waitFor(() => {
      expect(
        screen.getByTestId(`image-preview-${IMAGE_A}`).getAttribute('src'),
      ).toBe(FILE_URL_A);
    });
    expect(
      screen.getByTestId(`image-preview-${IMAGE_B}`).getAttribute('src'),
    ).toBe(FILE_URL_B);
    expect(imageGets(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
    expect(orderPatches(fetchMock)).toHaveLength(0);

    const block = screen.getByTestId('images-block');
    expect(block.textContent?.toLowerCase().includes('svg')).toBe(false);
    const input = screen.getByLabelText(
      'Файлы изображений',
    ) as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.accept.toLowerCase().includes('svg')).toBe(false);
    expect(
      screen.getByTestId('clips-list-block').compareDocumentPosition(block) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('пустой список из full не шлёт imageIds и показывает пустое состояние', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull({ images: [] }) });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByText('Изображений нет')).toBeTruthy();
    });
    expect(imageGets(fetchMock)).toHaveLength(0);
    expect(orderPatches(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
  });

  it('отправка уходит полем files, 201 показывает превью по fileUrl', async () => {
    const uploaded = [
      sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A, order: 0 }),
      sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 1 }),
    ];
    const fetchMock = stubCardFetch({
      full: sampleFull(),
      uploadBody: uploaded,
      listBody: uploaded,
    });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Файлы изображений')).toBeTruthy();
    });
    expect(imageGets(fetchMock)).toHaveLength(0);

    const first = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const second = new File(['b'], 'b.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Файлы изображений'), {
      target: { files: [first, second] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Загрузить изображения' }),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`image-preview-${IMAGE_A}`).getAttribute('src'),
      ).toBe(FILE_URL_A);
    });
    expect(
      screen.getByTestId(`image-preview-${IMAGE_B}`).getAttribute('src'),
    ).toBe(FILE_URL_B);

    const upload = imagePosts(fetchMock)[0];
    if (upload === undefined) {
      throw new Error('нет POST .../images');
    }
    const init = upload[1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.getAll('files')).toEqual([first, second]);
    expect(form.has('file')).toBe(false);
    expect(new Headers(init.headers).get('Content-Type')).toBeNull();
    expect(String(upload[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/images`,
    );
    expect(fullGets(fetchMock)).toHaveLength(1);
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('частичный POST .../images не затирает уже показанные', async () => {
    const initial = [
      sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A, order: 0 }),
      sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 1 }),
      sampleImage({ id: IMAGE_C, fileUrl: FILE_URL_C, order: 2 }),
    ];
    const uploaded = [
      sampleImage({ id: IMAGE_D, fileUrl: FILE_URL_D, order: 3 }),
      sampleImage({ id: IMAGE_E, fileUrl: FILE_URL_E, order: 4 }),
    ];
    const listed = [
      sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A_FRESH, order: 0 }),
      sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 1 }),
      sampleImage({ id: IMAGE_C, fileUrl: FILE_URL_C, order: 2 }),
      ...uploaded,
    ];
    const fetchMock = stubCardFetch({
      full: sampleFull({ images: initial }),
      uploadBody: uploaded,
      listBody: listed,
    });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByTestId(`image-preview-${IMAGE_A}`)).toBeTruthy();
    });
    expect(imageIdsOnScreen()).toEqual([IMAGE_A, IMAGE_B, IMAGE_C]);

    fireEvent.change(screen.getByLabelText('Файлы изображений'), {
      target: {
        files: [
          new File(['d'], 'd.jpg', { type: 'image/jpeg' }),
          new File(['e'], 'e.png', { type: 'image/png' }),
        ],
      },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Загрузить изображения' }),
    );

    await waitFor(() => {
      expect(imageGets(fetchMock)).toHaveLength(1);
    });
    await waitFor(() => {
      expect(imageIdsOnScreen()).toEqual([
        IMAGE_A,
        IMAGE_B,
        IMAGE_C,
        IMAGE_D,
        IMAGE_E,
      ]);
    });
    expect(imageIdsOnScreen()).not.toEqual([IMAGE_D, IMAGE_E]);
    expect(
      screen.getByTestId(`image-preview-${IMAGE_A}`).getAttribute('src'),
    ).toBe(FILE_URL_A_FRESH);
    expect(
      screen.getByTestId(`image-preview-${IMAGE_A}`).getAttribute('src'),
    ).not.toBe(FILE_URL_A);
    expect(imagePosts(fetchMock)).toHaveLength(1);
  });

  it('11 файлов в сеть не уходят', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull() });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Файлы изображений')).toBeTruthy();
    });
    const files = Array.from(
      { length: 11 },
      (_, index) =>
        new File(['x'], `pic-${String(index)}.jpg`, { type: 'image/jpeg' }),
    );
    fireEvent.change(screen.getByLabelText('Файлы изображений'), {
      target: { files },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Загрузить изображения' }),
    );

    expect(
      screen.getByText('За один раз можно загрузить не больше 10 файлов'),
    ).toBeTruthy();
    expect(imagePosts(fetchMock)).toHaveLength(0);
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('415, 413 и 400 files is required показывают message', async () => {
    const cases = [
      { status: 415, message: 'Unsupported or disallowed file type' },
      { status: 413, message: 'File too large' },
      { status: 400, message: 'files is required' },
    ];

    for (const item of cases) {
      cleanup();
      vi.unstubAllGlobals();
      stubCardFetch({
        full: sampleFull(),
        uploadStatus: item.status,
        uploadMessage: item.message,
      });
      await renderCard();
      await waitFor(() => {
        expect(screen.getByLabelText('Файлы изображений')).toBeTruthy();
      });
      fireEvent.change(screen.getByLabelText('Файлы изображений'), {
        target: {
          files: [new File(['x'], 'pic.jpg', { type: 'image/jpeg' })],
        },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Загрузить изображения' }),
      );
      await waitFor(() => {
        expect(screen.getByText(item.message)).toBeTruthy();
      });
      expect(screen.getByTestId('composition-card-form')).toBeTruthy();
      expect(screen.queryByText('Войти')).toBeNull();
    }
  });

  it('перетаскивание шлёт полный imageIds в новом порядке', async () => {
    const initial = [
      sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A, order: 0 }),
      sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 1 }),
      sampleImage({ id: IMAGE_C, fileUrl: FILE_URL_C, order: 2 }),
    ];
    const reordered = [
      sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 0 }),
      sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A, order: 1 }),
      sampleImage({ id: IMAGE_C, fileUrl: FILE_URL_C, order: 2 }),
    ];
    installImageRects();
    const fetchMock = stubCardFetch({
      full: sampleFull({ images: initial }),
      orderBody: reordered,
    });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByTestId(`image-preview-${IMAGE_A}`)).toBeTruthy();
    });
    expect(orderPatches(fetchMock)).toHaveLength(0);

    await moveImageDown(IMAGE_A);

    await waitFor(() => {
      expect(orderPatches(fetchMock)).toHaveLength(1);
    });
    const patch = orderPatches(fetchMock)[0];
    if (patch === undefined) {
      throw new Error('нет PATCH .../images/order');
    }
    const patchInit = patch[1] as RequestInit;
    if (typeof patchInit.body !== 'string') {
      throw new Error('Ожидалось строковое тело порядка');
    }
    const body = JSON.parse(patchInit.body) as {
      imageIds: string[];
    };
    expect(body).toEqual({
      imageIds: [IMAGE_B, IMAGE_A, IMAGE_C],
    });
    expect(body.imageIds).toHaveLength(initial.length);
    expect(new Set(body.imageIds)).toEqual(
      new Set(initial.map((image) => image.id)),
    );
    expect(String(patch[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/images/order`,
    );
    await waitFor(() => {
      expect(imageIdsOnScreen()).toEqual([IMAGE_B, IMAGE_A, IMAGE_C]);
    });
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('400 несовпадения набора показывает message', async () => {
    const initial = [
      sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A, order: 0 }),
      sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 1 }),
    ];
    installImageRects();
    stubCardFetch({
      full: sampleFull({ images: initial }),
      orderStatus: 400,
      orderMessage: MISMATCH,
    });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByTestId(`image-preview-${IMAGE_A}`)).toBeTruthy();
    });
    await moveImageDown(IMAGE_A);

    await waitFor(() => {
      expect(screen.getByText(MISMATCH)).toBeTruthy();
    });
    expect(imageIdsOnScreen()).toEqual([IMAGE_A, IMAGE_B]);
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('согласие на удаление вызывает DELETE и убирает превью', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        images: [sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A })],
      }),
    });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByTestId(`image-preview-${IMAGE_A}`)).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить изображение ${IMAGE_A}` }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(imageDeletes(fetchMock)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(screen.queryByTestId(`image-preview-${IMAGE_A}`)).toBeNull();
    });
    expect(screen.getByText('Изображений нет')).toBeTruthy();
    const deletion = imageDeletes(fetchMock);
    expect(deletion).toHaveLength(1);
    const deletionCall = deletion[0];
    if (deletionCall === undefined) {
      throw new Error('нет DELETE .../images/:imageId');
    }
    expect(String(deletionCall[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/images/${IMAGE_A}`,
    );
    expect(String(deletionCall[0])).not.toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
    expect((deletionCall[1] as RequestInit).method).toBe('DELETE');
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('после DELETE картинки удалённого id нет, список перечитан своим GET', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        images: [
          sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A, order: 0 }),
          sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_B, order: 1 }),
        ],
      }),
      listBody: [
        sampleImage({ id: IMAGE_B, fileUrl: FILE_URL_A_FRESH, order: 0 }),
      ],
    });
    await renderCard();

    await waitFor(() => {
      expect(screen.getByTestId(`image-preview-${IMAGE_A}`)).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить изображение ${IMAGE_A}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(imageGets(fetchMock)).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.queryByTestId(`image-preview-${IMAGE_A}`)).toBeNull();
    });
    expect(imageIdsOnScreen()).toEqual([IMAGE_B]);
    expect(
      screen.getByTestId(`image-preview-${IMAGE_B}`).getAttribute('src'),
    ).toBe(FILE_URL_A_FRESH);
  });

  it('отмена удаления не вызывает fetch', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        images: [sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A })],
      }),
    });
    await renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: `Удалить изображение ${IMAGE_A}` }),
      ).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить изображение ${IMAGE_A}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(imageDeletes(fetchMock)).toHaveLength(0);
    expect(screen.getByTestId(`image-preview-${IMAGE_A}`)).toBeTruthy();
  });

  it('404 удаления показывает message', async () => {
    stubCardFetch({
      full: sampleFull({
        images: [sampleImage({ id: IMAGE_A, fileUrl: FILE_URL_A })],
      }),
      deleteStatus: 404,
      deleteMessage: 'Not Found',
    });
    await renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: `Удалить изображение ${IMAGE_A}` }),
      ).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole('button', { name: `Удалить изображение ${IMAGE_A}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(screen.getByText('Not Found')).toBeTruthy();
    });
    expect(screen.getByTestId(`image-preview-${IMAGE_A}`)).toBeTruthy();
    expect(screen.queryByText('Войти')).toBeNull();
  });
});

async function moveImageDown(imageId: string) {
  const handle = screen.getByRole('button', {
    name: `Переместить изображение ${imageId}`,
  });
  handle.focus();
  fireEvent.keyDown(handle, { code: 'Space', key: ' ' });
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

function installImageRects() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const index = this.getAttribute('data-image-index');
      if (index === null) {
        return new DOMRect(0, 0, 0, 0);
      }
      return new DOMRect(0, Number(index) * 100, 240, 80);
    },
  );
}

function imageIdsOnScreen(): string[] {
  return [...document.querySelectorAll('[data-image-id]')].map(
    (node) => node.getAttribute('data-image-id') ?? '',
  );
}

async function renderCard() {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, {
    initialEntries: [`/compositions/${COMPOSITION_ID}`],
  });
  const view = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: 'Изображения' })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Изображения' }));
  return view;
}

function stubCardFetch({
  full,
  uploadStatus = 201,
  uploadMessage,
  uploadBody = [],
  listBody = [],
  orderStatus = 200,
  orderMessage,
  orderBody = [],
  deleteStatus = 204,
  deleteMessage,
}: {
  full: ReturnType<typeof sampleFull>;
  uploadStatus?: number;
  uploadMessage?: string;
  uploadBody?: unknown;
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
      pathname === `/compositions/${COMPOSITION_ID}/images` &&
      method === 'POST'
    ) {
      if (uploadStatus >= 400) {
        return Promise.resolve(
          errorJson(uploadStatus, uploadMessage ?? 'Error', pathname),
        );
      }
      return Promise.resolve(jsonResponse(201, uploadBody));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/images` &&
      method === 'GET'
    ) {
      return Promise.resolve(jsonResponse(200, listBody));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/images/order` &&
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
      pathname.startsWith(`/compositions/${COMPOSITION_ID}/images/`) &&
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
    images?: CompositionImage[];
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
    images: overrides.images ?? [],
    notes: [],
  };
}

function sampleImage(
  overrides: Partial<CompositionImage> = {},
): CompositionImage {
  return {
    id: IMAGE_A,
    fileUrl: FILE_URL_A,
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

function imageGets(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'GET', `/compositions/${COMPOSITION_ID}/images`);
}

function imagePosts(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'POST', `/compositions/${COMPOSITION_ID}/images`);
}

function orderPatches(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(
    fetchMock,
    'PATCH',
    `/compositions/${COMPOSITION_ID}/images/order`,
  );
}

function imageDeletes(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    const method = init?.method ?? 'GET';
    const pathname = new URL(String(call[0])).pathname;
    return (
      method === 'DELETE' &&
      pathname.startsWith(`/compositions/${COMPOSITION_ID}/images/`)
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
