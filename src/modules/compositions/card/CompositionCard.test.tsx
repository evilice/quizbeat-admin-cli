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

vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: () => undefined,
      destroy: () => undefined,
    }),
  },
}));
import { makeAccessToken } from '../../../shared/testing/make-access-token.ts';
import { RootStore } from '../../../shared/store/root-store.ts';
import type { SessionStorage } from '../../session/session-store.ts';
import { AppProviders } from '../../../app/App.tsx';
import { routes } from '../../../app/routes.tsx';

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const UNKNOWN_TAG_MESSAGE =
  'One or more tagIds do not reference an existing tag';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('карточка композиции', () => {
  it('монтирование /compositions/:id с state и без вызывает ровно один GET .../full', async () => {
    const fetchMock = stubCardFetch();
    renderCard({
      state: { title: 'Pending Title', author: 'Pending Author' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeTruthy();
    });
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe(
      'Song One',
    );

    const fullCalls = getFullCalls(fetchMock);
    expect(fullCalls).toHaveLength(1);
    expect(new URL(String(fullCalls[0]?.[0])).pathname).toBe(
      `/compositions/${COMPOSITION_ID}/full`,
    );
    expect(getCompositionListCalls(fetchMock)).toHaveLength(0);
    expect(getBareCompositionGetCalls(fetchMock, COMPOSITION_ID)).toHaveLength(
      0,
    );

    cleanup();
    vi.unstubAllGlobals();

    const fetchMockNoState = stubCardFetch();
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeTruthy();
    });
    expect(getFullCalls(fetchMockNoState)).toHaveLength(1);
    expect(getCompositionListCalls(fetchMockNoState)).toHaveLength(0);
    expect(
      getBareCompositionGetCalls(fetchMockNoState, COMPOSITION_ID),
    ).toHaveLength(0);
  });

  it('404 на GET .../full показывает «не найдена» и ссылку на список, без вечного индикатора', async () => {
    stubCardFetch({ fullStatus: 404 });
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Композиция не найдена')).toBeTruthy();
    });
    expect(
      screen
        .getByRole('link', { name: 'К списку композиций' })
        .getAttribute('href'),
    ).toBe('/compositions');
    expect(screen.queryByLabelText('Загрузка композиции')).toBeNull();
    expect(screen.queryByLabelText('Название')).toBeNull();
  });

  it('сохранение после снятия всех тегов шлёт JSON с tagIds: []', async () => {
    const tagA = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440001',
      code: 'rock',
      translations: [
        { locale: 'ru', name: 'Рок' },
        { locale: 'en', name: 'Rock' },
      ],
    });
    const fetchMock = stubCardFetch({
      full: sampleCompositionFull({
        tags: [tagA],
      }),
      tags: [tagA],
    });
    renderCard();

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Название') as HTMLInputElement).value,
      ).toBe('Song One');
    });

    fireEvent.mouseDown(screen.getByLabelText('Теги'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Рок' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Рок' }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });

    const body = patchBodies(fetchMock)[0];
    expect(body).toEqual({
      title: 'Song One',
      author: 'Author',
      status: 'DRAFT',
      tagIds: [],
    });
    expect(body).toHaveProperty('tagIds');
    expect(body.tagIds).toEqual([]);
  });

  it('сохранение без изменения тегов ключа tagIds не содержит', async () => {
    const fetchMock = stubCardFetch({
      full: sampleCompositionFull({
        tags: [
          sampleTag({
            id: '550e8400-e29b-41d4-a716-446655440001',
          }),
        ],
      }),
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });

    const body = patchBodies(fetchMock)[0];
    expect(body).toEqual({
      title: 'Renamed',
      author: 'Author',
      status: 'DRAFT',
    });
    expect(body).not.toHaveProperty('tagIds');
  });

  it('смена статуса на PUBLISHED шлёт status: "PUBLISHED"', async () => {
    const fetchMock = stubCardFetch();
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeTruthy();
    });

    fireEvent.mouseDown(screen.getByLabelText('Статус'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Опубликована' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Опубликована' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });

    expect(patchBodies(fetchMock)[0]).toMatchObject({
      status: 'PUBLISHED',
    });
  });

  it('пустое название не вызывает fetch', async () => {
    const fetchMock = stubCardFetch();
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByText('Укажите название')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(patchBodies(fetchMock)).toHaveLength(0);
  });

  it('400 про неизвестный тег показывает message на карточке', async () => {
    const tagA = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440099',
      code: 'ghost',
      translations: [
        { locale: 'ru', name: 'Призрак' },
        { locale: 'en', name: 'Ghost' },
      ],
    });
    stubCardFetch({
      full: sampleCompositionFull(),
      tags: [tagA],
      patchStatus: 400,
      patchBody: {
        statusCode: 400,
        message: UNKNOWN_TAG_MESSAGE,
        error: 'Bad Request',
        path: `/compositions/${COMPOSITION_ID}`,
        timestamp: '2026-09-25T00:00:00.000Z',
      },
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeTruthy();
    });

    fireEvent.mouseDown(screen.getByLabelText('Теги'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Призрак' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Призрак' }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(screen.getByText(UNKNOWN_TAG_MESSAGE)).toBeTruthy();
    });
    expect(screen.getByTestId('composition-card-form')).toBeTruthy();
  });

  it('успешный PATCH композиции не обнуляет clips / images / notes', async () => {
    const clip = {
      id: 'clip-1',
      difficulty: 'EASY' as const,
      durationSec: 5,
      startTimeSec: 0,
      status: 'DONE' as const,
      fileUrl: 'https://example.com/clip.mp3',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const image = {
      id: 'img-1',
      fileUrl: 'https://example.com/img.png',
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const note = {
      id: 'note-1',
      translations: [{ locale: 'ru' as const, text: 'Факт' }],
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const audioUrl = 'https://example.com/original.mp3';
    stubCardFetch({
      full: sampleCompositionFull({
        originalAudioUrl: audioUrl,
        originalAudioDurationSec: 120,
        clips: [clip],
        images: [image],
        notes: [note],
      }),
      patchResponse: sampleComposition({
        title: 'After Patch',
        tags: [],
      }),
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByTestId('composition-card-form')).toBeTruthy();
    });
    const formBefore = screen.getByTestId('composition-card-form');
    expect(formBefore.getAttribute('data-clips-count')).toBe('1');
    expect(formBefore.getAttribute('data-images-count')).toBe('1');
    expect(formBefore.getAttribute('data-notes-count')).toBe('1');
    expect(formBefore.getAttribute('data-original-audio-url')).toBe(audioUrl);

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'After Patch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Название') as HTMLInputElement).value,
      ).toBe('After Patch');
    });

    const formAfter = screen.getByTestId('composition-card-form');
    expect(formAfter.getAttribute('data-clips-count')).toBe('1');
    expect(formAfter.getAttribute('data-images-count')).toBe('1');
    expect(formAfter.getAttribute('data-notes-count')).toBe('1');
    expect(formAfter.getAttribute('data-original-audio-url')).toBe(audioUrl);

    fireEvent.click(screen.getByRole('tab', { name: 'Аудио' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Аудио' })).getByText(
        'Готово',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Изображения' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Изображения' })).getByTestId(
        'image-preview-img-1',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Заметки' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Заметки' })).getByText(
        'Факт',
      ),
    ).toBeTruthy();
  });

  it('разделы карточки переключаются вкладками', async () => {
    stubCardFetch();
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeTruthy();
    });
    expect(
      screen.getByRole('tab', { name: 'Общее', selected: true }),
    ).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'Общее' })).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Аудио' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Аудио' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Аудио' })).getByText(
        'Трек не загружен',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Общее' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Изображения' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Изображения' })).getByText(
        'Изображений нет',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Аудио' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Заметки' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Заметки' })).getByRole(
        'heading',
        { name: 'А знали ли Вы?' },
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Изображения' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Общее' }));
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe(
      'Song One',
    );
  });

  it('со строки списка «Изменить» открывает карточку с мгновенным заголовком', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        const parsed = new URL(String(url));
        const method = init?.method ?? 'GET';
        if (parsed.pathname.endsWith('/tags') && method === 'GET') {
          return Promise.resolve(
            jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
          );
        }
        if (
          parsed.pathname === `/compositions/${COMPOSITION_ID}/full` &&
          method === 'GET'
        ) {
          return Promise.resolve(
            jsonResponse(200, sampleCompositionFull({ title: 'Loaded Title' })),
          );
        }
        if (parsed.pathname.endsWith('/compositions') && method === 'GET') {
          return Promise.resolve(
            jsonResponse(200, {
              items: [
                sampleComposition({
                  id: COMPOSITION_ID,
                  title: 'List Title',
                  author: 'List Author',
                }),
              ],
              total: 1,
              page: 1,
              limit: 20,
            }),
          );
        }
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      });
    vi.stubGlobal('fetch', fetchMock);

    const store = new RootStore(createMemoryStorage());
    store.session.setPair(
      makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
      'refresh-1',
      'viewer@example.com',
    );
    const router = createMemoryRouter(routes, {
      initialEntries: ['/compositions'],
    });
    render(
      <AppProviders store={store}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('List Title')).toBeTruthy();
    });

    const row = screen.getByText('List Title').closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(
      within(row as HTMLElement).getByRole('button', { name: 'Изменить' }),
    );

    await waitFor(() => {
      expect(getFullCalls(fetchMock)).toHaveLength(1);
    });
    expect(router.state.location.pathname).toBe(
      `/compositions/${COMPOSITION_ID}`,
    );
    expect(router.state.location.state).toEqual({
      title: 'List Title',
      author: 'List Author',
    });

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Название') as HTMLInputElement).value,
      ).toBe('Loaded Title');
    });
  });
});

const renderCard = ({
  state,
}: {
  state?: { title?: string; author?: string };
} = {}) => {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, {
    initialEntries: [
      {
        pathname: `/compositions/${COMPOSITION_ID}`,
        state,
      },
    ],
  });
  return render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

const stubCardFetch = ({
  full = sampleCompositionFull(),
  fullStatus = 200,
  tags = [] as ReturnType<typeof sampleTag>[],
  patchStatus = 200,
  patchResponse,
  patchBody,
}: {
  full?: ReturnType<typeof sampleCompositionFull>;
  fullStatus?: number;
  tags?: ReturnType<typeof sampleTag>[];
  patchStatus?: number;
  patchResponse?: ReturnType<typeof sampleComposition>;
  patchBody?: unknown;
} = {}) => {
  const fetchMock = vi
    .fn()
    .mockImplementation((url: string, init?: RequestInit) => {
      const parsed = new URL(String(url));
      const method = init?.method ?? 'GET';

      if (
        method === 'PATCH' &&
        parsed.pathname === `/compositions/${COMPOSITION_ID}`
      ) {
        if (patchStatus >= 400) {
          return Promise.resolve(jsonResponse(patchStatus, patchBody));
        }
        return Promise.resolve(
          jsonResponse(
            200,
            patchResponse ??
              sampleComposition({
                title: full.title,
                author: full.author,
                status: full.status,
                tags: full.tags,
              }),
          ),
        );
      }

      if (parsed.pathname.endsWith('/tags') && method === 'GET') {
        return Promise.resolve(
          jsonResponse(200, {
            items: tags,
            total: tags.length,
            page: 1,
            limit: 100,
          }),
        );
      }

      if (
        parsed.pathname === `/compositions/${COMPOSITION_ID}/full` &&
        method === 'GET'
      ) {
        if (fullStatus === 404) {
          return Promise.resolve(
            jsonResponse(404, {
              statusCode: 404,
              message: 'Not Found',
              error: 'Not Found',
              path: `/compositions/${COMPOSITION_ID}/full`,
              timestamp: '2026-09-25T00:00:00.000Z',
            }),
          );
        }
        return Promise.resolve(jsonResponse(200, full));
      }

      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const getFullCalls = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return url.includes('/full') && method === 'GET';
  });
};

const getCompositionListCalls = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    if (method !== 'GET') {
      return false;
    }
    const pathname = new URL(url).pathname;
    return pathname === '/compositions';
  });
};

const getBareCompositionGetCalls = (
  fetchMock: ReturnType<typeof vi.fn>,
  id: string,
) => {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    if (method !== 'GET') {
      return false;
    }
    const pathname = new URL(url).pathname;
    return pathname === `/compositions/${id}`;
  });
};

const patchBodies = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return JSON.parse(typeof body === 'string' ? body : '') as Record<
        string,
        unknown
      >;
    });
};

const sampleTag = (
  overrides: {
    id?: string;
    code?: string;
    translations?: { locale: 'ru' | 'en'; name: string }[];
  } = {},
) => {
  return {
    id: overrides.id ?? 'tag-id',
    code: overrides.code ?? 'rock',
    translations: overrides.translations ?? [
      { locale: 'ru' as const, name: 'Рок' },
      { locale: 'en' as const, name: 'Rock' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
};

const sampleComposition = (
  overrides: {
    id?: string;
    title?: string;
    author?: string;
    status?: 'DRAFT' | 'PUBLISHED';
    tags?: ReturnType<typeof sampleTag>[];
  } = {},
) => {
  return {
    id: overrides.id ?? COMPOSITION_ID,
    title: overrides.title ?? 'Song One',
    author: overrides.author ?? 'Author',
    status: overrides.status ?? 'DRAFT',
    createdById: 'admin-1',
    tags: overrides.tags ?? [],
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
};

const sampleCompositionFull = (
  overrides: Partial<{
    id: string;
    title: string;
    author: string;
    status: 'DRAFT' | 'PUBLISHED';
    tags: ReturnType<typeof sampleTag>[];
    originalAudioUrl: string | null;
    originalAudioDurationSec: number | null;
    clips: unknown[];
    images: unknown[];
    notes: unknown[];
  }> = {},
) => {
  return {
    ...sampleComposition(overrides),
    originalAudioUrl:
      overrides.originalAudioUrl !== undefined
        ? overrides.originalAudioUrl
        : null,
    originalAudioDurationSec:
      overrides.originalAudioDurationSec !== undefined
        ? overrides.originalAudioDurationSec
        : null,
    clips: overrides.clips ?? [],
    images: overrides.images ?? [],
    notes: overrides.notes ?? [],
  };
};

const jsonResponse = (status: number, body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const createMemoryStorage = (
  initial: Record<string, string> = {},
): SessionStorage => {
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
};
