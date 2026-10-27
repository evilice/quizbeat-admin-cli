import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../../app/App.tsx';
import { routes } from '../../app/routes.tsx';
import { apiBaseUrl } from '../../shared/api/api-base-url.ts';
import { makeAccessToken } from '../../shared/testing/make-access-token.ts';
import { RootStore } from '../../shared/store/root-store.ts';
import type { SessionStorage } from '../session/session-store.ts';
import { STORAGE_DENIED_MESSAGE } from './storage-display.ts';
import type { StorageSweepResult } from './storage-store.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('страница хранилища', () => {
  it('без предпросмотра «Удалить» неактивна, нулевой результат её не включает', async () => {
    const empty = sampleResult({
      applied: false,
      total: { count: 0, bytes: 0 },
    });
    const fetchMock = stubSweep(empty, empty);
    renderStorage();

    const remove = screen.getByRole('button', { name: 'Удалить' });
    expect((remove as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeTruthy();
    });
    expect(requestBody(fetchMock, 0)).toEqual({ apply: false });
    expect(screen.getByText('Всего')).toBeTruthy();
    expect(screen.getByText('Удалять нечего.')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'Удалить',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('пока идёт проверка, кнопки недоступны и второй запрос не уходит', async () => {
    let release: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderStorage();

    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });
    expect(
      (screen.getByRole('button', { name: 'Удалить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText('Запрос выполняется.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(jsonResponse(200, sampleResult({ applied: false })));
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });

  it('подтверждение показывает числа предпросмотра, итог берётся из ответа удаления', async () => {
    const preview = sampleResult({
      applied: false,
      byPrefix: [
        { prefix: 'images', count: 1, bytes: 512 },
        { prefix: 'audio', count: 2, bytes: 1536 },
        { prefix: 'video', count: 0, bytes: 0 },
      ],
      total: { count: 3, bytes: 2048 },
    });
    const outcome = sampleResult({
      applied: true,
      byPrefix: [
        { prefix: 'images', count: 1, bytes: 512 },
        { prefix: 'audio', count: 1, bytes: 512 },
        { prefix: 'video', count: 0, bytes: 0 },
      ],
      total: { count: 2, bytes: 1024 },
      failed: 1,
      failedBytes: 512,
    });
    const fetchMock = stubSweep(preview, outcome);
    renderStorage();

    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Удалить 3 файла (2 КБ)' }),
      ).toBeTruthy();
    });
    expect(within(row('Картинки')).getByText('512 Б')).toBeTruthy();
    expect(within(row('Аудио')).getByText('1,5 КБ')).toBeTruthy();
    expect(within(row('Всего')).getByText('3')).toBeTruthy();
    expect(within(row('Всего')).getByText('2 КБ')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Удалить 3 файла (2 КБ)' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/3 файла \(2 КБ\)/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Удалить 3 файла (2 КБ)' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Удалить',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Удалено: 2 файла')).toBeTruthy();
    });
    expect(requestBody(fetchMock, 1)).toEqual({ apply: true });
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `${apiBaseUrl}/storage/sweep`,
    );
    expect(screen.getByText('Освобождено: 1 КБ')).toBeTruthy();
    expect(screen.getByText('Ошибок: 1')).toBeTruthy();
    expect(
      screen.getByText(
        'Часть файлов не удалена (512 Б). Проверьте хранилище заново.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Удалено: 3 файла')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      (screen.getByRole('button', { name: 'Удалить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('409 показывает сообщение и снова включает кнопки без второго удаления', async () => {
    const preview = sampleResult({
      applied: false,
      total: { count: 2, bytes: 2048 },
      byPrefix: [
        { prefix: 'images', count: 2, bytes: 2048 },
        { prefix: 'audio', count: 0, bytes: 0 },
        { prefix: 'video', count: 0, bytes: 0 },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, preview)))
      .mockImplementationOnce(() =>
        Promise.resolve(
          errorJson(409, 'Storage sweep is already running', '/storage/sweep'),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderStorage();

    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Удалить 2 файла (2 КБ)' }),
      ).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Удалить 2 файла (2 КБ)' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Удалить',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Storage sweep is already running')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const dialog = screen.getByRole('dialog');
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Удалить',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Отмена',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      (screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole('button', {
          name: 'Удалить 2 файла (2 КБ)',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('403 показывает message сервера и не очищает сессию', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(errorJson(403, 'Forbidden resource', '/storage/sweep')),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { store } = renderStorage();
    const access = store.session.accessToken;

    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(() => {
      expect(screen.getByText('Forbidden resource')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
    expect(store.session.accessToken).toBe(access);
    expect(store.session.refreshToken).toBe('refresh-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(
      '/auth/staff/refresh',
    );
    expect(
      (screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('ADMIN не видит пункт меню и страницу /storage', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderStorage('ADMIN');

    expect(screen.queryByRole('link', { name: 'Хранилище' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Хранилище' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Проверить' })).toBeNull();
    expect(screen.getByText(STORAGE_DENIED_MESSAGE)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function row(label: string): HTMLElement {
  const cell = screen.getByText(label);
  const line = cell.closest('tr');
  expect(line).toBeTruthy();
  return line as HTMLElement;
}

function renderStorage(role: 'ADMIN' | 'SUPER_ADMIN' = 'SUPER_ADMIN') {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role, type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, { initialEntries: ['/storage'] });
  const view = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, store };
}

function stubSweep(
  preview: StorageSweepResult,
  outcome: StorageSweepResult,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockImplementation((_url: string, init?: RequestInit) => {
      const body = init?.body;
      if (typeof body !== 'string') {
        throw new Error('Ожидалось строковое тело запроса');
      }
      const parsed = JSON.parse(body) as { apply?: unknown };
      const apply = parsed.apply === true;
      return Promise.resolve(jsonResponse(200, apply ? outcome : preview));
    });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sampleResult(
  overrides: Partial<StorageSweepResult> = {},
): StorageSweepResult {
  return {
    applied: false,
    byPrefix: [
      { prefix: 'images', count: 0, bytes: 0 },
      { prefix: 'audio', count: 0, bytes: 0 },
      { prefix: 'video', count: 0, bytes: 0 },
    ],
    total: { count: 0, bytes: 0 },
    failed: 0,
    failedBytes: 0,
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
    error: status === 403 ? 'Forbidden' : 'Conflict',
    path,
    timestamp: '2026-10-27T00:00:00.000Z',
  });
}

function requestBody(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): Record<string, unknown> {
  const body = (fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)
    ?.body;
  if (typeof body !== 'string') {
    throw new Error('Ожидалось строковое тело запроса');
  }
  return JSON.parse(body) as Record<string, unknown>;
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
