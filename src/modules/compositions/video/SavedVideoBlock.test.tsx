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
import { AppProviders } from '../../../app/App.tsx';
import { routes } from '../../../app/routes.tsx';
import type { SessionStorage } from '../../session/session-store.ts';
import { apiBaseUrl } from '../../../shared/api/api-base-url.ts';
import { makeAccessToken } from '../../../shared/testing/make-access-token.ts';
import { RootStore } from '../../../shared/store/root-store.ts';

vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: () => undefined,
      isPlaying: () => false,
      destroy: () => undefined,
    }),
  },
}));

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const OLD_URL = 'https://example.com/old.mp4';
const FRESH_URL = 'https://example.com/fresh.mp4';
const STALE_URL = 'https://example.com/stale.mp4';
const OTHER_URL = 'https://example.com/other.mp4';
const HINT =
  'mp4, webm, ориентир размера — 500 МБ; тип и размер проверяет сервер; видео с iPhone (.mov) не поддерживается';
const IRREVERSIBLE =
  'Исходный файл не хранится: вернуть прежнее видео или изменить его границы будет нельзя';
const PLAYBACK_FAILED = 'Не удалось воспроизвести видео';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('сохранённое видео на карточке', () => {
  it('без видео показывает редактор и не запрашивает ссылку', async () => {
    const fetchMock = stubCardFetch({ full: sampleFull() });
    await openVideoTab();

    const block = screen.getByTestId('saved-video-block');
    expect(within(block).getByText(HINT)).toBeTruthy();
    expect(within(block).queryByLabelText('Сохранённое видео')).toBeNull();
    expect(
      within(block).queryByRole('button', { name: 'Заменить видео' }),
    ).toBeNull();
    expect(videoGets(fetchMock)).toHaveLength(0);
    expect(fullGets(fetchMock)).toHaveLength(1);
  });

  it('показывает плеер по videoUrl и длительность и не запрашивает ссылку', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({
        status: 'PUBLISHED',
        videoUrl: OLD_URL,
        videoDurationSec: 12.5,
      }),
    });
    await openVideoTab();

    const player = screen.getByLabelText(
      'Сохранённое видео',
    ) as HTMLVideoElement;
    expect(player.getAttribute('src')).toBe(OLD_URL);
    expect(player.controls).toBe(true);
    expect(player.preload).toBe('metadata');
    expect(screen.getByText('Длительность: 12.5 с')).toBeTruthy();
    expect(screen.queryByText(HINT)).toBeNull();
    expect(videoGets(fetchMock)).toHaveLength(0);
    expect(
      screen.getByRole('combobox', { name: 'Статус', hidden: true })
        .textContent,
    ).toContain('Опубликована');
  });

  it('замена требует подтверждения, отмена оставляет прежнее видео', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
    });
    await openVideoTab();
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Заменить видео' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(IRREVERSIBLE)).toBeTruthy();
    expect(videoPosts(fetchMock)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.queryByLabelText('Видео-файл')).toBeNull();
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(
      screen
        .getByTestId('composition-card-form')
        .getAttribute('data-has-video-url'),
    ).toBe('true');
  });

  it('после сохранения src берётся из нового GET, не из прежней ссылки', async () => {
    installObjectUrls();
    let releaseGet: (response: Response) => void = () => undefined;
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoUpload: { status: 201, body: { videoDurationSec: 2.5 } },
      videoGet: () =>
        new Promise((resolve) => {
          releaseGet = resolve;
        }),
    });
    await openVideoTab();
    await confirmReplace();
    saveSelectedFile();

    await waitFor(() => {
      expect(screen.getByText('Получаем ссылку')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Сохранённое видео')).toBeNull();
    expect(screen.queryByText(OLD_URL)).toBeNull();
    expect(
      screen
        .getByTestId('composition-card-form')
        .getAttribute('data-has-video-url'),
    ).toBe('false');
    expect(videoGets(fetchMock)).toHaveLength(1);
    expect(videoPosts(fetchMock)).toHaveLength(1);

    releaseGet(jsonResponse(200, { url: FRESH_URL }));
    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });
    expect(screen.getByText('Длительность: 2.5 с')).toBeTruthy();
    expect(screen.queryByLabelText('Видео-файл')).toBeNull();
    expect(videoGets(fetchMock)).toHaveLength(1);
  });

  it('ошибка сохранения не убирает прежний плеер и не закрывает редактор', async () => {
    installObjectUrls();
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoUpload: {
        status: 422,
        body: {
          statusCode: 422,
          message: 'Unable to trim the video',
          error: 'Unprocessable Entity',
          path: `/compositions/${COMPOSITION_ID}/video`,
          timestamp: '2026-10-26T00:00:00.000Z',
        },
      },
    });
    await openVideoTab();
    await confirmReplace();
    saveSelectedFile();

    await waitFor(() => {
      expect(screen.getByText('Unable to trim the video')).toBeTruthy();
    });
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );
    expect(screen.getByLabelText('Видео-файл')).toBeTruthy();
    expect(videoGets(fetchMock)).toHaveLength(0);
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('удаление требует подтверждения, вызывает DELETE и возвращает пустое состояние', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
    });
    await openVideoTab();

    fireEvent.click(screen.getByRole('button', { name: 'Удалить видео' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(IRREVERSIBLE)).toBeTruthy();
    expect(videoDeletes(fetchMock)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(screen.getByText(HINT)).toBeTruthy();
    });
    expect(screen.queryByLabelText('Сохранённое видео')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    const deletion = videoDeletes(fetchMock);
    expect(deletion).toHaveLength(1);
    const deletionCall = deletion[0];
    if (deletionCall === undefined) {
      throw new Error('нет DELETE .../video');
    }
    expect(String(deletionCall[0])).toBe(
      `${apiBaseUrl}/compositions/${COMPOSITION_ID}/video`,
    );
    expect((deletionCall[1] as RequestInit).method).toBe('DELETE');
    const form = screen.getByTestId('composition-card-form');
    expect(form.getAttribute('data-has-video-url')).toBe('false');
    expect(form.getAttribute('data-video-duration')).toBe('');
  });

  it('отмена удаления не вызывает DELETE', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
    });
    await openVideoTab();
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Удалить видео' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(videoDeletes(fetchMock)).toHaveLength(0);
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );
  });

  it('ошибка удаления остаётся в диалоге и сбрасывается отменой', async () => {
    const message = 'Not Found <b>x</b>';
    stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      deleteStatus: 404,
      deleteMessage: message,
    });
    await openVideoTab();

    fireEvent.click(screen.getByRole('button', { name: 'Удалить видео' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(within(dialog).getByText(message)).toBeTruthy();
    });
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(dialog.querySelector('b')).toBeNull();
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.queryByText(message)).toBeNull();
  });

  it('ошибка плеера запрашивает ссылку один раз и не зацикливается', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoGet: () => Promise.resolve(jsonResponse(200, { url: FRESH_URL })),
    });
    await openVideoTab();

    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });
    expect(videoGets(fetchMock)).toHaveLength(1);
    expect(screen.queryByText(PLAYBACK_FAILED)).toBeNull();

    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    expect(screen.getByText(PLAYBACK_FAILED)).toBeTruthy();
    expect(videoGets(fetchMock)).toHaveLength(1);
  });

  it('та же ссылка после ошибки плеера не запрашивается повторно', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoGet: () => Promise.resolve(jsonResponse(200, { url: OLD_URL })),
    });
    await openVideoTab();

    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    await waitFor(() => {
      expect(screen.getByText(PLAYBACK_FAILED)).toBeTruthy();
    });
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );
    expect(videoGets(fetchMock)).toHaveLength(1);

    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    expect(videoGets(fetchMock)).toHaveLength(1);
  });

  it('устаревший GET после замены не возвращает ссылку прежней версии', async () => {
    installObjectUrls();
    let releaseStale: (response: Response) => void = () => undefined;
    let gets = 0;
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoUpload: { status: 201, body: { videoDurationSec: 3 } },
      videoGet: () => {
        gets += 1;
        if (gets === 1) {
          return new Promise((resolve) => {
            releaseStale = resolve;
          });
        }
        return Promise.resolve(jsonResponse(200, { url: FRESH_URL }));
      },
    });
    await openVideoTab();
    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    await waitFor(() => {
      expect(videoGets(fetchMock)).toHaveLength(1);
    });

    await confirmReplace();
    saveSelectedFile();
    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });

    await act(async () => {
      releaseStale(jsonResponse(200, { url: STALE_URL }));
    });
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      FRESH_URL,
    );
    expect(screen.queryByText(STALE_URL)).toBeNull();
    expect(videoGets(fetchMock)).toHaveLength(2);
  });

  it('404 на GET ссылки считает, что видео нет', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: null, videoDurationSec: 4 }),
      videoGet: () =>
        Promise.resolve(
          errorJson(404, 'Not Found', `/compositions/${COMPOSITION_ID}/video`),
        ),
    });
    await openVideoTab();

    await waitFor(() => {
      expect(screen.getByText(HINT)).toBeTruthy();
    });
    expect(screen.queryByLabelText('Сохранённое видео')).toBeNull();
    expect(screen.queryByText('Not Found')).toBeNull();
    const form = screen.getByTestId('composition-card-form');
    expect(form.getAttribute('data-has-video-url')).toBe('false');
    expect(form.getAttribute('data-video-duration')).toBe('');
    expect(videoGets(fetchMock)).toHaveLength(1);
  });

  it('ошибка GET ссылки показывается текстом и не повторяется', async () => {
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: null, videoDurationSec: 4 }),
      videoGet: () =>
        Promise.resolve(
          errorJson(
            500,
            'Internal server error',
            `/compositions/${COMPOSITION_ID}/video`,
          ),
        ),
    });
    await openVideoTab();

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Сохранённое видео')).toBeNull();
    expect(screen.queryByText('Получаем ссылку')).toBeNull();
    expect(screen.queryByText(HINT)).toBeNull();
    expect(videoGets(fetchMock)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Удалить видео' })).toBeTruthy();
  });

  it('«Повторить» после ошибки GET ссылки запрашивает ссылку снова', async () => {
    let attempt = 0;
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: null, videoDurationSec: 4 }),
      videoGet: () => {
        attempt += 1;
        return Promise.resolve(
          attempt === 1
            ? errorJson(
                500,
                'Internal server error',
                `/compositions/${COMPOSITION_ID}/video`,
              )
            : jsonResponse(200, { url: FRESH_URL }),
        );
      },
    });
    await openVideoTab();
    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });
    expect(screen.queryByText('Internal server error')).toBeNull();
    expect(videoGets(fetchMock)).toHaveLength(2);
  });

  it('пока идёт загрузка замены, замена и удаление недоступны', async () => {
    installObjectUrls();
    let releasePost: (response: Response) => void = () => undefined;
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoPost: () =>
        new Promise((resolve) => {
          releasePost = resolve;
        }),
      videoGet: () => Promise.resolve(jsonResponse(200, { url: FRESH_URL })),
    });
    await openVideoTab();
    await confirmReplace();
    saveSelectedFile();

    await waitFor(() => {
      expect(
        (
          screen.getByRole('button', {
            name: 'Заменить видео',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });
    expect(
      (
        screen.getByRole('button', {
          name: 'Удалить видео',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    releasePost(jsonResponse(201, { videoDurationSec: 2.5 }));
    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });
    expect(
      (
        screen.getByRole('button', {
          name: 'Удалить видео',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(videoDeletes(fetchMock)).toHaveLength(0);
  });

  it('«Отменить замену» закрывает редактор и оставляет прежнее видео', async () => {
    installObjectUrls();
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
    });
    await openVideoTab();
    await confirmReplace();

    fireEvent.click(screen.getByRole('button', { name: 'Отменить замену' }));

    expect(screen.queryByLabelText('Видео-файл')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Отменить замену' }),
    ).toBeNull();
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );
    expect(videoPosts(fetchMock)).toHaveLength(0);
    expect(videoGets(fetchMock)).toHaveLength(0);
  });

  it('пока идёт обновление ссылки, повторные «Повторить» не плодят запросы', async () => {
    let release: (response: Response) => void = () => undefined;
    let attempt = 0;
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoGet: () => {
        attempt += 1;
        if (attempt === 1) {
          return Promise.resolve(
            errorJson(
              500,
              'Internal server error',
              `/compositions/${COMPOSITION_ID}/video`,
            ),
          );
        }
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    await openVideoTab();
    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    expect(videoGets(fetchMock)).toHaveLength(2);

    release(jsonResponse(200, { url: FRESH_URL }));
    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });
    expect(videoGets(fetchMock)).toHaveLength(2);
  });

  it('открытие редактора замены ставит сохранённый плеер на паузу', async () => {
    installObjectUrls();
    stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
    });
    await openVideoTab();
    const player = screen.getByLabelText(
      'Сохранённое видео',
    ) as HTMLVideoElement;
    const pause = vi.spyOn(player, 'pause').mockImplementation(() => undefined);

    await confirmReplace();

    expect(pause).toHaveBeenCalled();
  });

  it('«Повторить» после неудачного обновления протухшей ссылки обходит троттлинг', async () => {
    let attempt = 0;
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoGet: () => {
        attempt += 1;
        return Promise.resolve(
          attempt === 1
            ? errorJson(
                500,
                'Internal server error',
                `/compositions/${COMPOSITION_ID}/video`,
              )
            : jsonResponse(200, { url: FRESH_URL }),
        );
      },
    });
    await openVideoTab();

    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeTruthy();
    });
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });
    expect(screen.queryByText('Internal server error')).toBeNull();
    expect(videoGets(fetchMock)).toHaveLength(2);
  });

  it('уход с вкладки ставит сохранённое видео на паузу', async () => {
    stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
    });
    await openVideoTab();
    const player = screen.getByLabelText(
      'Сохранённое видео',
    ) as HTMLVideoElement;
    const pause = vi.spyOn(player, 'pause').mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole('tab', { name: 'Заметки' }));
    expect(pause).toHaveBeenCalled();
    expect(player.isConnected).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: 'Видео' }));
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OLD_URL,
    );
  });

  it('GET ошибки, завершившийся сразу после сохранения, не возвращает прежнюю ссылку', async () => {
    installObjectUrls();
    let releasePost: (response: Response) => void = () => undefined;
    let releaseStale: (response: Response) => void = () => undefined;
    let gets = 0;
    const fetchMock = stubCardFetch({
      full: sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
      videoPost: () =>
        new Promise((resolve) => {
          releasePost = resolve;
        }),
      videoGet: () => {
        gets += 1;
        if (gets === 1) {
          return new Promise((resolve) => {
            releaseStale = resolve;
          });
        }
        return Promise.resolve(jsonResponse(200, { url: FRESH_URL }));
      },
    });
    await openVideoTab();
    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    await waitFor(() => {
      expect(videoGets(fetchMock)).toHaveLength(1);
    });
    await confirmReplace();
    saveSelectedFile();
    await waitFor(() => {
      expect(videoPosts(fetchMock)).toHaveLength(1);
    });

    await act(async () => {
      releasePost(jsonResponse(201, { videoDurationSec: 3 }));
      releaseStale(jsonResponse(200, { url: STALE_URL }));
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText('Сохранённое видео').getAttribute('src'),
      ).toBe(FRESH_URL);
    });
    expect(screen.getByText('Длительность: 3 с')).toBeTruthy();
    expect(screen.queryByText('Длительность: 8 с')).toBeNull();
  });

  it('GET после перехода на другую композицию не подменяет её видео', async () => {
    let releaseGet: (response: Response) => void = () => undefined;
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
        return Promise.resolve(
          jsonResponse(
            200,
            sampleFull({ videoUrl: OLD_URL, videoDurationSec: 8 }),
          ),
        );
      }
      if (pathname === `/compositions/${OTHER_ID}/full` && method === 'GET') {
        return Promise.resolve(
          jsonResponse(200, {
            ...sampleFull({ videoUrl: OTHER_URL, videoDurationSec: 5 }),
            id: OTHER_ID,
            title: 'Song Two',
          }),
        );
      }
      if (
        pathname === `/compositions/${COMPOSITION_ID}/video` &&
        method === 'GET'
      ) {
        return new Promise<Response>((resolve) => {
          releaseGet = resolve;
        });
      }
      return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const router = await openVideoTab();
    fireEvent.error(screen.getByLabelText('Сохранённое видео'));
    await waitFor(() => {
      expect(videoGets(fetchMock)).toHaveLength(1);
    });

    await act(async () => {
      await router.navigate(`/compositions/${OTHER_ID}`);
    });
    await waitFor(() => {
      expect(screen.getByText('Song Two — Author')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Видео' }));
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OTHER_URL,
    );

    await act(async () => {
      releaseGet(jsonResponse(200, { url: STALE_URL }));
    });
    expect(screen.getByLabelText('Сохранённое видео').getAttribute('src')).toBe(
      OTHER_URL,
    );
    expect(screen.getByText('Длительность: 5 с')).toBeTruthy();
    expect(screen.getByText('Song Two — Author')).toBeTruthy();
  });
});

const openVideoTab = async () => {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, {
    initialEntries: [`/compositions/${COMPOSITION_ID}`],
  });
  render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: 'Видео' })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Видео' }));
  return router;
};

const confirmReplace = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Заменить видео' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Продолжить' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(screen.getByLabelText('Видео-файл')).toBeTruthy();
};

const saveSelectedFile = () => {
  const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('Видео-файл'), {
    target: { files: [file] },
  });
  const preview = screen.getByLabelText(
    'Предпросмотр видео',
  ) as HTMLVideoElement;
  Object.defineProperty(preview, 'duration', {
    configurable: true,
    get: () => 12,
  });
  fireEvent.loadedMetadata(preview);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
};

const installObjectUrls = () => {
  const createObjectUrl = vi.fn((_blob: Blob): string => 'blob:saved-video');
  const revokeObjectUrl = vi.fn((_url: string): void => undefined);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob): string {
        return createObjectUrl(blob);
      }

      static revokeObjectURL(url: string): void {
        revokeObjectUrl(url);
      }
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
    Promise.resolve(),
  );
  return { createObjectUrl, revokeObjectUrl };
};

const stubCardFetch = ({
  full,
  videoUpload,
  videoPost,
  videoGet,
  deleteStatus = 204,
  deleteMessage,
}: {
  full: ReturnType<typeof sampleFull>;
  videoUpload?: { status: number; body: unknown };
  videoPost?: () => Promise<Response>;
  videoGet?: () => Promise<Response>;
  deleteStatus?: number;
  deleteMessage?: string;
}) => {
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
    if (pathname === `/compositions/${COMPOSITION_ID}/video`) {
      if (method === 'POST') {
        if (videoPost !== undefined) {
          return videoPost();
        }
        if ((videoUpload?.status ?? 500) >= 400) {
          return Promise.resolve(
            jsonResponse(videoUpload?.status ?? 500, videoUpload?.body),
          );
        }
        return Promise.resolve(
          jsonResponse(videoUpload?.status ?? 201, videoUpload?.body),
        );
      }
      if (method === 'GET' && videoGet !== undefined) {
        return videoGet();
      }
      if (method === 'DELETE') {
        if (deleteStatus === 204) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(
          errorJson(deleteStatus, deleteMessage ?? 'Error', pathname),
        );
      }
    }
    return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const sampleFull = (
  overrides: {
    status?: 'DRAFT' | 'PUBLISHED';
    videoUrl?: string | null;
    videoDurationSec?: number | null;
  } = {},
) => {
  return {
    id: COMPOSITION_ID,
    title: 'Song One',
    author: 'Author',
    status: overrides.status ?? 'DRAFT',
    createdById: 'admin-1',
    tags: [],
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    originalAudioUrl: null,
    originalAudioDurationSec: null,
    videoUrl: overrides.videoUrl === undefined ? null : overrides.videoUrl,
    videoDurationSec:
      overrides.videoDurationSec === undefined
        ? null
        : overrides.videoDurationSec,
    clips: [],
    images: [],
    notes: [],
  };
};

const jsonResponse = (status: number, body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const errorJson = (status: number, message: string, path: string): Response => {
  return jsonResponse(status, {
    statusCode: status,
    message,
    error: 'Error',
    path,
    timestamp: '2026-10-26T00:00:00.000Z',
  });
};

const callsBy = (
  fetchMock: ReturnType<typeof vi.fn>,
  method: string,
  pathname: string,
) => {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    const actual = init?.method ?? 'GET';
    return actual === method && new URL(String(call[0])).pathname === pathname;
  });
};

const videoGets = (fetchMock: ReturnType<typeof vi.fn>) => {
  return callsBy(fetchMock, 'GET', `/compositions/${COMPOSITION_ID}/video`);
};

const videoPosts = (fetchMock: ReturnType<typeof vi.fn>) => {
  return callsBy(fetchMock, 'POST', `/compositions/${COMPOSITION_ID}/video`);
};

const videoDeletes = (fetchMock: ReturnType<typeof vi.fn>) => {
  return callsBy(fetchMock, 'DELETE', `/compositions/${COMPOSITION_ID}/video`);
};

const fullGets = (fetchMock: ReturnType<typeof vi.fn>) => {
  return callsBy(fetchMock, 'GET', `/compositions/${COMPOSITION_ID}/full`);
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
