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
import { apiBaseUrl } from '../api/api-base-url.ts';
import type { AudioClip } from '../stores/compositions-store.ts';
import { makeAccessToken } from '../stores/make-access-token.ts';
import { RootStore } from '../stores/root-store.ts';
import type { SessionStorage } from '../stores/session-store.ts';
import { AppProviders } from './App.tsx';
import { ClipsListBlock } from './ClipsListBlock.tsx';
import { routes } from './routes.tsx';

const waveCreate = vi.hoisted(() => vi.fn());
const waveErrors = vi.hoisted(() => ({
  handlers: [] as Array<() => void>,
}));

vi.mock('wavesurfer.js', () => ({
  default: {
    create: (options: unknown) => {
      waveCreate(options);
      let onError: (() => void) | undefined;
      return {
        on: (event: string, handler: () => void) => {
          if (event === 'error') {
            onError = handler;
            waveErrors.handlers.push(handler);
          }
        },
        destroy: () => {
          if (onError !== undefined) {
            const failed = onError;
            waveErrors.handlers = waveErrors.handlers.filter(
              (item) => item !== failed,
            );
          }
        },
      };
    },
  },
}));

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const CLIP_ID = '22222222-2222-2222-2222-222222222222';
const AUDIO_URL = 'https://example.com/original.mp3';
const FILE_REQUIRED = 'file is required';
const UNSUPPORTED = 'Unsupported or disallowed file type';
const TOO_LARGE = 'File too large';
const ALREADY_PROCESSING = 'Audio clip is already pending or being processed';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  waveCreate.mockClear();
  waveErrors.handlers = [];
});

describe('загрузка исходного трека', () => {
  it('выбор файла уходит полем file, 201 кладёт длительность, /full блок не вызывает', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull(),
      audioUpload: { originalAudioDurationSec: 96 },
      audioUrl: { url: 'https://example.com/fresh.mp3' },
      clips: [],
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Трек не загружен')).toBeTruthy();
    });
    expect(audioGets(fetchMock)).toHaveLength(0);
    expect(clipGets(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);

    const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
    fireEvent.change(screen.getByLabelText('Файл трека'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }));

    await waitFor(() => {
      expect(
        screen.getByTestId('audio-upload-block').getAttribute('data-duration'),
      ).toBe('96');
    });
    expect(screen.getByText('Трек принят. Длительность: 96 с.')).toBeTruthy();

    const upload = audioPosts(fetchMock)[0];
    if (upload === undefined) {
      throw new Error('нет POST .../audio');
    }
    const body = (upload[1] as RequestInit).body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect((body as FormData).has('files')).toBe(false);
    expect(fullGets(fetchMock)).toHaveLength(1);
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('после успеха тот же файл можно выбрать снова', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull(),
      audioUpload: { originalAudioDurationSec: 96 },
      audioUrl: { url: 'https://example.com/fresh.mp3' },
      clips: [],
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Файл трека')).toBeTruthy();
    });
    const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
    const input = screen.getByLabelText('Файл трека') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }));

    await waitFor(() => {
      expect(audioPosts(fetchMock)).toHaveLength(1);
    });
    expect(input.value).toBe('');
    expect(
      (screen.getByRole('button', { name: 'Загрузить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }));

    await waitFor(() => {
      expect(audioPosts(fetchMock)).toHaveLength(2);
    });
  });

  it('415, 413 и 400 file is required показывают message', async () => {
    const cases = [
      { status: 415, message: UNSUPPORTED },
      { status: 413, message: TOO_LARGE },
      { status: 400, message: FILE_REQUIRED },
    ];

    for (const item of cases) {
      cleanup();
      vi.unstubAllGlobals();
      stubCardFetch({
        full: sampleFull(),
        audioStatus: item.status,
        audioMessage: item.message,
      });
      renderCard();
      await waitFor(() => {
        expect(screen.getByLabelText('Файл трека')).toBeTruthy();
      });
      fireEvent.change(screen.getByLabelText('Файл трека'), {
        target: {
          files: [
            new File(['x'], 'bad.bin', { type: 'application/octet-stream' }),
          ],
        },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }));
      await waitFor(() => {
        expect(screen.getByText(item.message)).toBeTruthy();
      });
      expect(screen.getByTestId('composition-card-form')).toBeTruthy();
    }
  });

  it('originalAudioUrl: null — трек не загружен, без GET .../audio и без ухода на логин', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull() });
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Трек не загружен')).toBeTruthy();
    });
    expect(
      screen
        .getByTestId('audio-upload-block')
        .getAttribute('data-track-loaded'),
    ).toBe('false');
    expect(audioGets(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
    expect(screen.queryByLabelText('Старт, с')).toBeNull();
    expect(screen.queryByText('Войти')).toBeNull();
  });
});

describe('волна и точки', () => {
  it('собирает points с целым стартом, допустимой длительностью и сложностью', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        originalAudioUrl: AUDIO_URL,
        originalAudioDurationSec: 30,
      }),
      clipsAfterCreate: [sampleClip({ status: 'PENDING' })],
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Старт, с')).toBeTruthy();
    });
    expect(audioGets(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
    expect(
      screen.getByTestId('audio-waveform').getAttribute('data-audio-url'),
    ).toBe(AUDIO_URL);
    expect(waveCreate).toHaveBeenCalledWith(
      expect.objectContaining({ url: AUDIO_URL }),
    );
    expect(
      screen
        .getByTestId('waveform-points-block')
        .getAttribute('data-boundary-duration'),
    ).toBe('30');

    fireEvent.change(screen.getByLabelText('Старт, с'), {
      target: { value: '2' },
    });
    fireEvent.mouseDown(screen.getByLabelText('Длительность'));
    fireEvent.click(screen.getByRole('option', { name: '8 с' }));
    fireEvent.mouseDown(screen.getByLabelText('Сложность'));
    fireEvent.click(screen.getByRole('option', { name: 'Сложная' }));
    fireEvent.click(screen.getByRole('button', { name: 'Добавить точку' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить точки' }));

    await waitFor(() => {
      expect(clipPosts(fetchMock)).toHaveLength(1);
    });
    const created = clipPosts(fetchMock)[0];
    if (created === undefined) {
      throw new Error('нет POST .../clips');
    }
    const rawBody = (created[1] as RequestInit).body;
    if (typeof rawBody !== 'string') {
      throw new Error('тело POST .../clips не строка');
    }
    const body = JSON.parse(rawBody) as {
      points: {
        startTimeSec: number;
        durationSec: number;
        difficulty: string;
      }[];
    };
    expect(body.points).toEqual([
      { startTimeSec: 2, durationSec: 8, difficulty: 'HARD' },
    ]);
    expect(Number.isInteger(body.points[0]?.startTimeSec)).toBe(true);
    expect(fullGets(fetchMock)).toHaveLength(1);
  });

  it('точка за границей длительности и пустой черновик не вызывают fetch', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        originalAudioUrl: AUDIO_URL,
        originalAudioDurationSec: 10,
      }),
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText('Старт, с')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Отправить точки' }));
    expect(clipPosts(fetchMock)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Старт, с'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить точку' }));
    expect(
      screen.getByText('Точка выходит за длительность трека'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить точки' }));

    expect(clipPosts(fetchMock)).toHaveLength(0);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('без длительности точки отправить нельзя и /full не повторяется', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull() });
    renderCard();

    await waitFor(() => {
      expect(
        screen.getByText('Разметка доступна после загрузки трека'),
      ).toBeTruthy();
    });
    expect(
      screen.queryByRole('button', { name: 'Отправить точки' }),
    ).toBeNull();
    expect(clipPosts(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
    expect(audioGets(fetchMock)).toHaveLength(0);
  });

  it('волна берёт originalAudioUrl без GET .../audio; протухшая ссылка обновляется отдельно', async () => {
    const fresh = 'https://example.com/refreshed.mp3';
    const fetchMock = stubCardFetch({
      full: sampleFull({
        originalAudioUrl: AUDIO_URL,
        originalAudioDurationSec: 40,
      }),
      audioUrl: { url: fresh },
    });
    renderCard();

    await waitFor(() => {
      expect(screen.getByTestId('audio-waveform')).toBeTruthy();
    });
    expect(
      screen.getByTestId('audio-waveform').getAttribute('data-audio-url'),
    ).toBe(AUDIO_URL);
    expect(audioGets(fetchMock)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Обновить ссылку' }));

    await waitFor(() => {
      expect(
        screen.getByTestId('audio-waveform').getAttribute('data-audio-url'),
      ).toBe(fresh);
    });
    expect(audioGets(fetchMock)).toHaveLength(1);
    expect(new URL(String(audioGets(fetchMock)[0]?.[0])).pathname).toBe(
      `/compositions/${COMPOSITION_ID}/audio`,
    );
    expect(fullGets(fetchMock)).toHaveLength(1);
  });

  it('повторная ошибка волны не запрашивает новый URL', async () => {
    let audioCalls = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
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
          jsonResponse(
            200,
            sampleFull({
              originalAudioUrl: AUDIO_URL,
              originalAudioDurationSec: 40,
            }),
          ),
        );
      }
      if (
        parsed.pathname === `/compositions/${COMPOSITION_ID}/audio` &&
        method === 'GET'
      ) {
        audioCalls += 1;
        return Promise.resolve(
          jsonResponse(200, {
            url: `https://example.com/fresh-${String(audioCalls)}.mp3`,
          }),
        );
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCard();

    await waitFor(() => {
      expect(screen.getByTestId('audio-waveform')).toBeTruthy();
    });

    await emitWaveError();
    await waitFor(() => {
      expect(audioGets(fetchMock)).toHaveLength(1);
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('audio-waveform').getAttribute('data-audio-url'),
      ).toBe('https://example.com/fresh-1.mp3');
    });

    await emitWaveError();
    await emitWaveError();
    expect(audioGets(fetchMock)).toHaveLength(1);
    expect(screen.getByText('Не удалось открыть ссылку на трек')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Обновить ссылку' }));
    await waitFor(() => {
      expect(audioGets(fetchMock)).toHaveLength(2);
    });
    await emitWaveError();
    expect(audioGets(fetchMock)).toHaveLength(2);
  });

  it('удаление точки и повторное добавление не склеивает ключи', async () => {
    stubCardFetch({
      full: sampleFull({
        originalAudioUrl: AUDIO_URL,
        originalAudioDurationSec: 30,
      }),
    });
    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Добавить точку' }),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Добавить точку' }));
    fireEvent.click(screen.getByRole('button', { name: 'Добавить точку' }));
    const pointText = '0 с, 5 с, Лёгкая';
    expect(screen.getAllByText(pointText)).toHaveLength(2);

    fireEvent.click(removeDraftButton());
    fireEvent.click(screen.getByRole('button', { name: 'Добавить точку' }));
    expect(screen.getAllByText(pointText)).toHaveLength(2);

    fireEvent.click(removeDraftButton());
    expect(screen.getAllByText(pointText)).toHaveLength(1);
  });
});

describe('список отрезков и опрос', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('не запрашивает clips на маунте, если массив уже есть, в том числе пустой', () => {
    const fetchMock = vi.fn();
    renderClips([], fetchMock);
    expect(clipGets(fetchMock)).toHaveLength(0);

    cleanup();
    renderClips([sampleClip({ status: 'DONE' })], fetchMock);
    expect(clipGets(fetchMock)).toHaveLength(0);
  });

  it('при начальном PENDING опрос стартует сразу и первый GET уходит через 2 с', async () => {
    vi.useFakeTimers();
    const pending = sampleClip({ status: 'PENDING' });
    delete pending.fileUrl;
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, [sampleClip({ status: 'DONE' })])),
    );
    renderClips([pending], fetchMock);

    expect(clipGets(fetchMock)).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(clipGets(fetchMock)).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(clipGets(fetchMock)).toHaveLength(1);
  });

  it('ответ с PENDING планирует следующий GET, терминальные статусы и пустой список — нет', async () => {
    vi.useFakeTimers();
    const pending = sampleClip({ status: 'PENDING' });
    delete pending.fileUrl;
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, [pending])),
    );
    renderClips([pending], fetchMock);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(fetchMock)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(fetchMock)).toHaveLength(2);

    cleanup();
    const doneFetch = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, [
          sampleClip({ status: 'DONE' }),
          sampleClip({
            id: '33333333-3333-3333-3333-333333333333',
            status: 'FAILED',
          }),
        ]),
      ),
    );
    renderClips([pending], doneFetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(doneFetch)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(doneFetch)).toHaveLength(1);

    cleanup();
    const emptyFetch = vi.fn(() => Promise.resolve(jsonResponse(200, [])));
    renderClips([pending], emptyFetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(emptyFetch)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(emptyFetch)).toHaveLength(1);

    cleanup();
    const idleFetch = vi.fn();
    renderClips(
      [
        sampleClip({ status: 'DONE' }),
        sampleClip({
          id: '33333333-3333-3333-3333-333333333333',
          status: 'FAILED',
        }),
      ],
      idleFetch,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(idleFetch)).toHaveLength(0);
    expect(screen.getByText('Не удалось нарезать')).toBeTruthy();
    expect(
      screen.queryByRole('progressbar', { name: 'Не удалось нарезать' }),
    ).toBeNull();
  });

  it('строка не-DONE не читает fileUrl', () => {
    const pending = sampleClip({ status: 'PENDING' });
    delete pending.fileUrl;
    const guarded = new Proxy(pending, {
      get(target, prop, receiver) {
        if (prop === 'fileUrl') {
          throw new Error('fileUrl прочитан у отрезка не в DONE');
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    renderClips([guarded], vi.fn());
    expect(screen.getByText('В очереди')).toBeTruthy();
    expect(screen.queryByLabelText(`Прослушать ${CLIP_ID}`)).toBeNull();
  });

  it('размонтирование не оставляет следующий GET', async () => {
    vi.useFakeTimers();
    const pending = sampleClip({ status: 'PENDING' });
    delete pending.fileUrl;
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, [pending])),
    );
    const view = renderClips([pending], fetchMock);
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(clipGets(fetchMock)).toHaveLength(0);
  });
});

describe('удаление и перегенерация отрезка', () => {
  it('подтверждение удаления вызывает DELETE с clipId и 204 убирает строку', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const pathname = new URL(String(url)).pathname;
      if (method === 'DELETE' && pathname.endsWith(`/clips/${CLIP_ID}`)) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === 'GET' && pathname.endsWith('/clips')) {
        return Promise.resolve(jsonResponse(200, []));
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    renderClips([sampleClip({ status: 'DONE' })], fetchMock);

    fireEvent.click(
      screen.getByRole('button', { name: `Удалить отрезок ${CLIP_ID}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(screen.getByText('Отрезков нет')).toBeTruthy();
    });
    const deleted = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
    );
    expect(String(deleted?.[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/clips/${CLIP_ID}`,
    );
    expect(String(deleted?.[0])).not.toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}`,
    );
  });

  it('204 убирает строку, даже если повторный список упал', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const pathname = new URL(String(url)).pathname;
      if (method === 'DELETE' && pathname.endsWith(`/clips/${CLIP_ID}`)) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === 'GET' && pathname.endsWith('/clips')) {
        return Promise.resolve(
          jsonResponse(500, {
            statusCode: 500,
            message: 'list failed',
            error: 'Error',
            path: pathname,
            timestamp: '2026-09-25T00:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    renderClips([sampleClip({ status: 'DONE' })], fetchMock);

    fireEvent.click(
      screen.getByRole('button', { name: `Удалить отрезок ${CLIP_ID}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(screen.getByText('Отрезков нет')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('list failed')).toBeTruthy();
  });

  it('отмена удаления не вызывает fetch', async () => {
    const fetchMock = vi.fn();
    renderClips([sampleClip({ status: 'FAILED' })], fetchMock);
    const before = fetchMock.mock.calls.length;

    fireEvent.click(
      screen.getByRole('button', { name: `Удалить отрезок ${CLIP_ID}` }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    expect(fetchMock.mock.calls.length).toBe(before);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('перегенерация — POST без тела точек, статус PENDING, опрос снова идёт', async () => {
    vi.useFakeTimers();
    const pending = sampleClip({ status: 'PENDING' });
    delete pending.fileUrl;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const pathname = new URL(String(url)).pathname;
      if (method === 'POST' && pathname.endsWith('/regenerate')) {
        return Promise.resolve(jsonResponse(200, pending));
      }
      if (method === 'GET' && pathname.endsWith('/clips')) {
        return Promise.resolve(jsonResponse(200, [pending]));
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    renderClips([sampleClip({ status: 'DONE' })], fetchMock);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Перегенерировать' }));
    });
    expect(screen.getByText('В очереди')).toBeTruthy();

    const regen = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/regenerate'),
    );
    if (regen === undefined) {
      throw new Error('нет POST .../regenerate');
    }
    expect((regen[1] as RequestInit).method).toBe('POST');
    expect((regen[1] as RequestInit).body).toBeUndefined();
    expect(String(regen[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/clips/${CLIP_ID}/regenerate`,
    );

    const getsBefore = clipGets(fetchMock).length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(clipGets(fetchMock).length).toBe(getsBefore + 1);
  });

  it('409 перегенерации показывает message', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(409, {
          statusCode: 409,
          message: ALREADY_PROCESSING,
          error: 'Conflict',
          path: `/compositions/${COMPOSITION_ID}/clips/${CLIP_ID}/regenerate`,
          timestamp: '2026-09-25T00:00:00.000Z',
        }),
      ),
    );
    renderClips([sampleClip({ status: 'DONE' })], fetchMock);

    fireEvent.click(screen.getByRole('button', { name: 'Перегенерировать' }));
    await waitFor(() => {
      expect(screen.getByText(ALREADY_PROCESSING)).toBeTruthy();
    });
    expect(screen.getByText('Готово')).toBeTruthy();
  });
});

function removeDraftButton() {
  const button = screen.getAllByRole('button', { name: /Убрать точку/ })[0];
  if (button === undefined) {
    throw new Error('нет кнопки удаления точки');
  }
  return button;
}

async function emitWaveError() {
  const handlers = [...waveErrors.handlers];
  await act(async () => {
    for (const handler of handlers) {
      handler();
    }
  });
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

function renderClips(clips: AudioClip[], fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  return render(
    <AppProviders store={store}>
      <ClipsListBlock
        compositionId={COMPOSITION_ID}
        initialClips={clips}
        reloadToken={0}
      />
    </AppProviders>,
  );
}

function stubCardFetch({
  full,
  audioUpload,
  audioStatus = 201,
  audioMessage,
  audioUrl = { url: 'https://example.com/fresh.mp3' },
  clips = [],
  clipsAfterCreate,
}: {
  full: ReturnType<typeof sampleFull>;
  audioUpload?: { originalAudioDurationSec: number };
  audioStatus?: number;
  audioMessage?: string;
  audioUrl?: { url: string };
  clips?: unknown[];
  clipsAfterCreate?: unknown[];
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
      pathname === `/compositions/${COMPOSITION_ID}/audio` &&
      method === 'POST'
    ) {
      if (audioStatus >= 400) {
        return Promise.resolve(
          jsonResponse(audioStatus, {
            statusCode: audioStatus,
            message: audioMessage,
            error: 'Error',
            path: pathname,
            timestamp: '2026-09-25T00:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse(201, audioUpload));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/audio` &&
      method === 'GET'
    ) {
      return Promise.resolve(jsonResponse(200, audioUrl));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/clips` &&
      method === 'POST'
    ) {
      return Promise.resolve(jsonResponse(201, clipsAfterCreate ?? []));
    }
    if (
      pathname === `/compositions/${COMPOSITION_ID}/clips` &&
      method === 'GET'
    ) {
      return Promise.resolve(jsonResponse(200, clips));
    }
    return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sampleFull(
  overrides: {
    originalAudioUrl?: string | null;
    originalAudioDurationSec?: number | null;
    clips?: unknown[];
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
    originalAudioUrl: overrides.originalAudioUrl ?? null,
    originalAudioDurationSec: overrides.originalAudioDurationSec ?? null,
    clips: overrides.clips ?? [],
    images: [],
    notes: [],
  };
}

function sampleClip(overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id: CLIP_ID,
    difficulty: 'EASY',
    durationSec: 5,
    startTimeSec: 1,
    status: 'DONE',
    fileUrl: 'https://example.com/clip.mp3',
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

function callsBy(
  fetchMock: ReturnType<typeof vi.fn>,
  method: string,
  pathEndsWith: string,
) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    const actual = init?.method ?? 'GET';
    return actual === method && String(call[0]).includes(pathEndsWith);
  });
}

function audioGets(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'GET', `/compositions/${COMPOSITION_ID}/audio`);
}

function audioPosts(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'POST', `/compositions/${COMPOSITION_ID}/audio`);
}

function clipGets(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    const method = init?.method ?? 'GET';
    const pathname = new URL(String(call[0])).pathname;
    return (
      method === 'GET' && pathname === `/compositions/${COMPOSITION_ID}/clips`
    );
  });
}

function clipPosts(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'POST', `/compositions/${COMPOSITION_ID}/clips`);
}

function fullGets(fetchMock: ReturnType<typeof vi.fn>) {
  return callsBy(fetchMock, 'GET', '/full');
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
