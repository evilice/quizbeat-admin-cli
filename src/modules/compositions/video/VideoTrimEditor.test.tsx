import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../../app/App.tsx';
import { makeAccessToken } from '../../../shared/testing/make-access-token.ts';
import { RootStore } from '../../../shared/store/root-store.ts';
import type { SessionStorage } from '../../session/session-store.ts';
import { VideoTrimEditor } from './VideoTrimEditor.tsx';

const COMPOSITION_ID = '11111111-1111-1111-1111-111111111111';
const HINT =
  'mp4, webm, ориентир размера — 500 МБ; тип и размер проверяет сервер; видео с iPhone (.mov) не поддерживается';
const UNREADABLE = 'Не удалось прочитать видео; нужен mp4 или webm';
const UPLOAD_HINT = 'Идёт загрузка и обрезка — это может занять до пары минут';

let createUrl = vi.fn((_blob: Blob): string => 'blob:unused');
let revokeUrl = vi.fn((_url: string): void => undefined);
let playMedia = vi.spyOn(HTMLMediaElement.prototype, 'play');
let pauseMedia = vi.spyOn(HTMLMediaElement.prototype, 'pause');

beforeEach(() => {
  const urls = ['blob:video-1', 'blob:video-2', 'blob:video-3'];
  let index = 0;
  createUrl = vi.fn(() => {
    const url = urls[index] ?? `blob:video-${String(index)}`;
    index += 1;
    return url;
  });
  revokeUrl = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob): string {
        return createUrl(blob) as string;
      }

      static revokeObjectURL(url: string): void {
        revokeUrl(url);
      }
    },
  );
  playMedia = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  pauseMedia = vi
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('редактор видеоотрезка', () => {
  it('показывает подсказку и скрытый input mp4/webm', () => {
    renderEditor();

    expect(screen.getByText(HINT)).toBeTruthy();
    const input = screen.getByLabelText('Видео-файл') as HTMLInputElement;
    expect(input.accept).toBe('.mp4,.webm,video/mp4,video/webm');
    expect(input.type).toBe('file');
    expect(input.accept.includes('.mov')).toBe(false);
    expect(screen.queryByLabelText('Предпросмотр видео')).toBeNull();
    expect(saveDisabled()).toBe(true);
  });

  it('выбор файла показывает плеер с object URL, смена отзывает прежний', () => {
    renderEditor();
    chooseFile('first.mp4');

    const video = screen.getByLabelText(
      'Предпросмотр видео',
    ) as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('blob:video-1');
    expect(video.hasAttribute('controls')).toBe(true);
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(screen.getByText('first.mp4')).toBeTruthy();
    expect(revokeUrl).not.toHaveBeenCalled();

    chooseFile('second.webm', 'video/webm');

    expect(revokeUrl).toHaveBeenCalledWith('blob:video-1');
    expect(
      screen.getByLabelText('Предпросмотр видео').getAttribute('src'),
    ).toBe('blob:video-2');
    expect(screen.getByText('second.webm')).toBeTruthy();
    expect(screen.queryByText('first.mp4')).toBeNull();
    expect(screen.queryByText(UNREADABLE)).toBeNull();
  });

  it('размонтирование отзывает object URL', () => {
    const { unmount } = renderEditor();
    chooseFile();
    expect(revokeUrl).not.toHaveBeenCalled();

    unmount();

    expect(revokeUrl).toHaveBeenCalledWith('blob:video-1');
  });

  it('после метаданных ползунок охватывает ролик, по умолчанию не длиннее 60 с', () => {
    renderEditor();
    chooseFile();
    markLoaded(90);

    const start = slider('Начало отрезка');
    const end = slider('Конец отрезка');
    expect(start.getAttribute('aria-valuemin')).toBe('0');
    expect(start.getAttribute('aria-valuemax')).toBe('90');
    expect(start.getAttribute('aria-valuenow')).toBe('0');
    expect(end.getAttribute('aria-valuemin')).toBe('0');
    expect(end.getAttribute('aria-valuemax')).toBe('90');
    expect(end.getAttribute('aria-valuenow')).toBe('60');
    expect(field('Начало, с')).toBe('0');
    expect(field('Конец, с')).toBe('60');
  });

  it('короче максимума отрезок по умолчанию занимает весь ролик', () => {
    renderEditor();
    chooseFile();
    markLoaded(12);

    expect(slider('Конец отрезка').getAttribute('aria-valuemax')).toBe('12');
    expect(slider('Конец отрезка').getAttribute('aria-valuenow')).toBe('12');
    expect(field('Конец, с')).toBe('12');
  });

  it('невалидные границы блокируют сохранение и пишут причину', () => {
    const fetchMock = stubFetch(201, { videoDurationSec: 1 });
    renderEditor();
    chooseFile();
    markLoaded(90);

    setBounds('', '4');
    expect(screen.getByText('Начало и конец — числа')).toBeTruthy();
    expect(saveDisabled()).toBe(true);

    setBounds('   ', '4');
    expect(screen.getByText('Начало и конец — числа')).toBeTruthy();

    setBounds('-1', '4');
    expect(screen.getByText('Начало не меньше 0')).toBeTruthy();

    setBounds('4', '4');
    expect(screen.getByText('Конец должен быть позже начала')).toBeTruthy();

    setBounds('1', '1.05');
    expect(screen.getByText('Длина отрезка не меньше 0,1 с')).toBeTruthy();

    setBounds('0', '90');
    expect(screen.getByText('Длина отрезка не больше 60 с')).toBeTruthy();

    setBounds('85', '95');
    expect(screen.getByText('Конец не позже длительности видео')).toBeTruthy();
    expect(saveDisabled()).toBe(true);

    setBounds('1.1', '1.2');
    expect(screen.queryByText('Длина отрезка не меньше 0,1 с')).toBeNull();
    expect(saveDisabled()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('сохранение шлёт файл и выбранные границы, успех очищает предпросмотр', async () => {
    const fetchMock = stubFetch(201, { videoDurationSec: 2.48 });
    const onSaved = vi.fn();
    renderEditor({ onSaved });
    const file = chooseFile();
    markLoaded(90);
    setBounds('1.5', '4.25');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(COMPOSITION_ID, 2.48);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = requestBody(fetchMock);
    expect(body.get('file')).toEqual(file);
    expect(body.get('startSec')).toBe('1.5');
    expect(body.get('endSec')).toBe('4.25');
    expect(screen.queryByLabelText('Предпросмотр видео')).toBeNull();
    expect(screen.queryByText('clip.mp4')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledWith('blob:video-1');
    expect(saveDisabled()).toBe(true);
  });

  it('конец 4.996 с уходит как 4.99, чтобы округление не вышло за ролик', async () => {
    const fetchMock = stubFetch(201, { videoDurationSec: 4.99 });
    renderEditor();
    chooseFile();
    markLoaded(4.996);
    expect(field('Конец, с')).toBe('4.996');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const body = requestBody(fetchMock);
    expect(body.get('startSec')).toBe('0');
    expect(body.get('endSec')).toBe('4.99');
  });

  it('во время отправки блокирует ввод и не принимает второй файл', async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderEditor();
    chooseFile();
    markLoaded(12);
    setBounds('1', '3');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(UPLOAD_HINT)).toBeTruthy();
    expect(saveDisabled()).toBe(true);
    expect(playDisabled()).toBe(true);
    expect(
      (screen.getByLabelText('Видео-файл') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Начало, с') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Конец, с') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(slider('Начало отрезка').disabled).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Начало = текущая позиция',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    chooseFile('other.mp4');
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByText('clip.mp4')).toBeTruthy();
    expect(screen.queryByText('other.mp4')).toBeNull();

    release(jsonResponse(201, { videoDurationSec: 2 }));
    await waitFor(() => {
      expect(screen.queryByText(UPLOAD_HINT)).toBeNull();
    });
  });

  it('ошибки 400, 413 и 415 показываются текстом, файл и границы остаются', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderEditor();
    chooseFile();
    markLoaded(30);
    setBounds('1.5', '4.25');

    for (const status of [400, 413, 415]) {
      const message =
        status === 415 ? '<b>не тот тип</b>' : `отказ ${String(status)}`;
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          jsonResponse(status, {
            message,
          }),
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() => {
        expect(screen.getByText(message)).toBeTruthy();
      });
      expect(document.querySelector('b')).toBeNull();
      expect(screen.getByText('clip.mp4')).toBeTruthy();
      expect(field('Начало, с')).toBe('1.5');
      expect(field('Конец, с')).toBe('4.25');
      expect(
        screen.getByLabelText('Предпросмотр видео').getAttribute('src'),
      ).toBe('blob:video-1');
      expect(revokeUrl).not.toHaveBeenCalled();
    }
  });

  it('ошибка видео и нечитаемая длительность блокируют сохранение', () => {
    const fetchMock = stubFetch(201, { videoDurationSec: 1 });
    renderEditor();
    chooseFile();
    markLoaded(12);
    expect(saveDisabled()).toBe(false);

    fireEvent.error(screen.getByLabelText('Предпросмотр видео'));

    expect(screen.getByText(UNREADABLE)).toBeTruthy();
    expect(saveDisabled()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(fetchMock).not.toHaveBeenCalled();

    chooseFile('again.mp4');
    expect(screen.queryByText(UNREADABLE)).toBeNull();
    markLoaded(Number.POSITIVE_INFINITY);
    expect(screen.getByText(UNREADABLE)).toBeTruthy();
    expect(saveDisabled()).toBe(true);

    chooseFile('zero.mp4');
    markLoaded(0);
    expect(screen.getByText(UNREADABLE)).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Конец отрезка' })).toBeNull();
  });

  it('проигрывает выбранный отрезок и один раз возвращает позицию на начало', () => {
    renderEditor();
    chooseFile();
    const video = markLoaded(20);
    setBounds('1.25', '3');

    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    expect(video.currentTime).toBe(1.25);
    expect(playMedia).toHaveBeenCalled();

    video.currentTime = 3.2;
    fireEvent.timeUpdate(video);
    expect(pauseMedia).toHaveBeenCalled();
    expect(video.currentTime).toBe(1.25);

    pauseMedia.mockClear();
    video.currentTime = 5;
    fireEvent.timeUpdate(video);
    expect(pauseMedia).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(5);
  });

  it('пауза плеера посреди отрезка снимает ограничение: дальше обычный просмотр', () => {
    renderEditor();
    chooseFile();
    const video = markLoaded(20);
    setBounds('1.25', '3');

    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    fireEvent.pause(video);

    pauseMedia.mockClear();
    video.currentTime = 5;
    fireEvent.timeUpdate(video);
    expect(pauseMedia).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(5);
  });

  it('конец ролика снимает ограничение отрезка', () => {
    renderEditor();
    chooseFile();
    const video = markLoaded(20);
    setBounds('15', '20');

    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    fireEvent.ended(video);

    pauseMedia.mockClear();
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    expect(pauseMedia).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(20);
  });

  it('устаревшая пауза после нового запуска отрезка не снимает ограничение', () => {
    renderEditor();
    chooseFile();
    const video = markLoaded(20);
    setBounds('1.25', '3');

    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => false,
    });
    fireEvent.pause(video);

    video.currentTime = 3.2;
    fireEvent.timeUpdate(video);
    expect(pauseMedia).toHaveBeenCalled();
    expect(video.currentTime).toBe(1.25);
  });

  it('правка границ не рвёт обычный просмотр, не связанный с отрезком', () => {
    renderEditor();
    chooseFile();
    markLoaded(20);
    pauseMedia.mockClear();

    setBounds('2', '6');
    fireEvent.change(slider('Начало отрезка'), { target: { value: '3' } });

    expect(pauseMedia).not.toHaveBeenCalled();
  });

  it('правка границ снимает ошибку прошлой отправки', async () => {
    stubFetch(400, { message: 'длина больше 60 с' });
    renderEditor();
    chooseFile();
    markLoaded(30);
    setBounds('0', '20');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => {
      expect(screen.getByText('длина больше 60 с')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Конец, с'), {
      target: { value: '10' },
    });

    expect(screen.queryByText('длина больше 60 с')).toBeNull();
  });

  it('успешная загрузка сообщает карточке, даже если редактор размонтирован', async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const onSaved = vi.fn();
    const { unmount } = renderEditor({ onSaved });
    chooseFile();
    markLoaded(12);
    setBounds('1', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    unmount();
    release(jsonResponse(201, { videoDurationSec: 2 }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(COMPOSITION_ID, 2);
    });
  });

  it('предпросмотр играет те же сотые, что уйдут на сервер', () => {
    renderEditor();
    chooseFile();
    const video = markLoaded(20);
    setBounds('1.234', '3.456');

    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    expect(video.currentTime).toBe(1.23);

    video.currentTime = 3.46;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(1.23);
  });

  it('кнопки берут текущую позицию, смена границ останавливает проигрыш', () => {
    renderEditor();
    chooseFile();
    const video = markLoaded(20);
    setBounds('0', '10');
    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    pauseMedia.mockClear();

    video.currentTime = 2.256;
    fireEvent.click(
      screen.getByRole('button', { name: 'Начало = текущая позиция' }),
    );
    expect(field('Начало, с')).toBe('2.26');
    expect(pauseMedia).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    pauseMedia.mockClear();
    video.currentTime = 5.234;
    fireEvent.click(
      screen.getByRole('button', { name: 'Конец = текущая позиция' }),
    );
    expect(field('Конец, с')).toBe('5.23');
    expect(pauseMedia).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    pauseMedia.mockClear();
    fireEvent.change(screen.getByLabelText('Начало, с'), {
      target: { value: '3' },
    });
    expect(pauseMedia).toHaveBeenCalled();
  });

  it('текущая позиция у конца ролика не округляется за длительность', () => {
    renderEditor();
    chooseFile();
    const video = markLoaded(4.996);
    video.currentTime = 4.996;

    fireEvent.click(
      screen.getByRole('button', { name: 'Конец = текущая позиция' }),
    );

    expect(field('Конец, с')).toBe('4.99');
    expect(screen.queryByText('Конец не позже длительности видео')).toBeNull();
    expect(saveDisabled()).toBe(false);
  });

  it('округление, после которого отрезок короче 0,1 с, блокирует сохранение', () => {
    const fetchMock = stubFetch(201, { videoDurationSec: 1 });
    renderEditor();
    chooseFile();
    markLoaded(4.996);
    setBounds('4.896', '4.996');

    expect(screen.getByText('Длина отрезка не меньше 0,1 с')).toBeTruthy();
    expect(saveDisabled()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('отказ предыдущего play() не снимает новый проигрыш отрезка', async () => {
    let rejectFirst: (reason?: unknown) => void = () => undefined;
    let calls = 0;
    playMedia.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise<void>((_resolve, reject) => {
          rejectFirst = reject;
        });
      }
      return Promise.resolve();
    });
    renderEditor();
    chooseFile();
    const video = markLoaded(20);
    setBounds('1', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    fireEvent.change(screen.getByLabelText('Начало, с'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    rejectFirst(new Error('interrupted'));
    await Promise.resolve();

    pauseMedia.mockClear();
    video.currentTime = 3.2;
    fireEvent.timeUpdate(video);
    expect(pauseMedia).toHaveBeenCalled();
    expect(video.currentTime).toBe(1);
  });

  it('скрытая вкладка ставит предпросмотр на паузу', () => {
    const view = renderEditor({ active: true });
    chooseFile();
    markLoaded(20);
    setBounds('0', '8');
    fireEvent.click(screen.getByRole('button', { name: 'Проиграть отрезок' }));
    pauseMedia.mockClear();

    view.rerender(
      <AppProviders store={view.store}>
        <VideoTrimEditor
          compositionId={COMPOSITION_ID}
          active={false}
          onSaved={view.onSaved}
        />
      </AppProviders>,
    );

    expect(pauseMedia).toHaveBeenCalled();
  });
});

const renderEditor = ({
  active = true,
  onSaved = vi.fn(),
}: {
  active?: boolean;
  onSaved?: (compositionId: string, videoDurationSec: number) => void;
} = {}) => {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role: 'ADMIN', type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const view = render(
    <AppProviders store={store}>
      <VideoTrimEditor
        compositionId={COMPOSITION_ID}
        active={active}
        onSaved={onSaved}
      />
    </AppProviders>,
  );
  return { ...view, store, onSaved };
};

const chooseFile = (name = 'clip.mp4', type = 'video/mp4') => {
  const file = new File(['video-bytes'], name, { type });
  fireEvent.change(screen.getByLabelText('Видео-файл'), {
    target: { files: [file] },
  });
  return file;
};

const markLoaded = (duration: number) => {
  const video = screen.getByLabelText('Предпросмотр видео') as HTMLVideoElement;
  Object.defineProperty(video, 'duration', {
    configurable: true,
    get: () => duration,
  });
  fireEvent.loadedMetadata(video);
  return video;
};

const field = (label: string) => {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
};

const setBounds = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText('Начало, с'), {
    target: { value: start },
  });
  fireEvent.change(screen.getByLabelText('Конец, с'), {
    target: { value: end },
  });
};

const slider = (name: string) => {
  return screen.getByRole('slider', { name }) as HTMLInputElement;
};

const saveDisabled = () => {
  return (
    screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement
  ).disabled;
};

const playDisabled = () => {
  return (
    screen.getByRole('button', {
      name: 'Проиграть отрезок',
    }) as HTMLButtonElement
  ).disabled;
};

const stubFetch = (status: number, body: unknown) => {
  const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(status, body)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const requestBody = (fetchMock: ReturnType<typeof vi.fn>) => {
  const call = fetchMock.mock.calls[0];
  if (call === undefined) {
    throw new Error('запроса не было');
  }
  return (call[1] as RequestInit).body as FormData;
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
