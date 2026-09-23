import { ruRU } from '@mui/material/locale';
import { useTheme } from '@mui/material/styles';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../api/api-base-url.ts';
import { makeAccessToken } from '../stores/make-access-token.ts';
import { RootStore } from '../stores/root-store.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import {
  EMAIL_KEY,
  REFRESH_TOKEN_KEY,
  type SessionStorage,
} from '../stores/session-store.ts';
import { AppProviders } from './App.tsx';
import { routes } from './routes.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('оболочка', () => {
  it('на / без сессии показывает заголовок и поля входа, выхода нет', () => {
    renderAt('/');

    expect(
      screen.getByRole('heading', { name: 'Админка QuizBeat' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Выйти' })).toBeNull();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/пароль/i)).toBeTruthy();
  });

  it('хук стора возвращает экземпляр корневого стора', () => {
    const store = newRootStore();

    render(shell(store, '/', <StoreProbe expected={store} />));

    expect(screen.getByTestId('store-probe').textContent).toBe('same');
  });

  it('локаль темы совпадает с ruRU установленного пакета', () => {
    render(shell(newRootStore(), '/', <ThemeProbe />));

    expect(screen.getByTestId('theme-probe').textContent).toBe('match');
  });

  it('неизвестный путь без сессии показывает логин, а не пометку адреса', () => {
    renderAt('/missing');

    expect(
      screen.getByRole('heading', { name: 'Админка QuizBeat' }),
    ).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.queryByText('Такого адреса нет.')).toBeNull();
  });

  it('неизвестный путь с сессией показывает пометку, что адреса нет', async () => {
    const access = staffAccess('admin-1');
    stubFetch(() =>
      jsonResponse(200, {
        accessToken: access,
        refreshToken: 'refresh-restored',
      }),
    );
    const storage = createMemoryStorage({
      [REFRESH_TOKEN_KEY]: 'refresh-saved',
      [EMAIL_KEY]: 'admin@example.com',
    });

    render(shell(new RootStore(storage), '/missing'));

    await waitFor(() => {
      expect(screen.getByText('Такого адреса нет.')).toBeTruthy();
    });
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });
});

describe('роль в оболочке и пункт сотрудников', () => {
  it('SUPER_ADMIN видит пункт, переход на /admins показывает заглушку без fetch, id в шапке равен sub', () => {
    const sub = 'super-1';
    const access = makeAccessToken({
      sub,
      role: 'SUPER_ADMIN',
      type: 'staff',
    });
    const fetchMock = stubFetch(() =>
      jsonResponse(500, { message: 'unexpected' }),
    );
    const store = newRootStore();
    store.session.setPair(access, 'refresh-1', 'super@example.com');

    render(shell(store, '/'));

    expect(screen.getByText(sub)).toBeTruthy();
    expect(store.session.id).toBe(sub);
    const link = screen.getByRole('link', { name: 'Сотрудники' });
    expect(link.getAttribute('href')).toBe('/admins');

    fireEvent.click(link);

    expect(
      screen.getByText('Раздел сотрудников появится на следующем этапе.'),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('ADMIN пункт не видит, прямой заход на /admins — та же заглушка без fetch, id в шапке равен sub', () => {
    const sub = 'admin-2';
    const access = makeAccessToken({
      sub,
      role: 'ADMIN',
      type: 'staff',
    });
    const fetchMock = stubFetch(() =>
      jsonResponse(500, { message: 'unexpected' }),
    );
    const store = newRootStore();
    store.session.setPair(access, 'refresh-1', 'admin@example.com');

    render(shell(store, '/admins'));

    expect(screen.getByText(sub)).toBeTruthy();
    expect(store.session.id).toBe(sub);
    expect(screen.queryByRole('link', { name: 'Сотрудники' })).toBeNull();
    expect(
      screen.getByText('Раздел сотрудников появится на следующем этапе.'),
    ).toBeTruthy();
    expect(screen.queryByText(/доступ запрещён/i)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

describe('логин, восстановление и выход', () => {
  it('без refresh на / видны поля и заголовок, выхода нет', () => {
    renderAt('/');

    expect(
      screen.getByRole('heading', { name: 'Админка QuizBeat' }),
    ).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/пароль/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Выйти' })).toBeNull();
  });

  it('логин с моком 200 показывает email в шапке и прячет форму', async () => {
    const access = staffAccess('admin-1');
    stubFetch(() =>
      jsonResponse(200, {
        accessToken: access,
        refreshToken: 'refresh-new',
      }),
    );

    renderAt('/');

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'Admin@Example.com' },
    });
    fireEvent.change(screen.getByLabelText(/пароль/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeTruthy();
    });
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByLabelText(/пароль/i)).toBeNull();
    expect(
      screen.getByText('Рабочие экраны появятся на следующих этапах.'),
    ).toBeTruthy();
  });

  it('логин 401 показывает Invalid credentials и остаётся на форме', async () => {
    stubFetch(() =>
      jsonResponse(401, {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
        path: '/auth/staff/login',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );

    renderAt('/');

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/пароль/i), {
      target: { value: 'bad' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/пароль/i)).toBeTruthy();
  });

  it('логин 429 показывает message и не шлёт второй запрос', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(429, {
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
        error: 'Too Many Requests',
        path: '/auth/staff/login',
        timestamp: '2026-09-23T00:00:00.000Z',
      }),
    );

    renderAt('/');

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/пароль/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(
        screen.getByText('ThrottlerException: Too Many Requests'),
      ).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it('старт с сохранённым refresh вызывает восстановление один раз и открывает оболочку', async () => {
    const access = staffAccess('admin-1');
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        accessToken: access,
        refreshToken: 'refresh-restored',
      }),
    );
    const storage = createMemoryStorage({
      [REFRESH_TOKEN_KEY]: 'refresh-saved',
      [EMAIL_KEY]: 'saved@example.com',
    });

    render(shell(new RootStore(storage), '/'));

    expect(screen.queryByLabelText(/email/i)).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('saved@example.com')).toBeTruthy();
    });

    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('/auth/staff/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(String(refreshCalls[0]?.[0])).toBe(
      `${apiBaseUrl}/auth/staff/refresh`,
    );
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByLabelText(/пароль/i)).toBeNull();
    expect(
      screen.getByText('Рабочие экраны появятся на следующих этапах.'),
    ).toBeTruthy();
  });

  it('выход возвращает форму, повторный рендер без refresh не зовёт восстановление', async () => {
    const access = staffAccess('admin-1');
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/auth/staff/login')) {
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: access,
            refreshToken: 'refresh-new',
          }),
        );
      }
      if (String(url).endsWith('/auth/staff/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(
        jsonResponse(500, { message: 'unexpected' }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const storage = createMemoryStorage();
    const store = new RootStore(storage);
    const { unmount } = render(shell(store, '/'));

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/пароль/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Выйти' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeTruthy();
    });
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();

    unmount();
    fetchMock.mockClear();

    render(shell(new RootStore(storage), '/'));

    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('/auth/staff/refresh'),
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

function renderAt(path: string): void {
  render(shell(newRootStore(), path));
}

function shell(store: RootStore, path: string, probe?: ReactNode) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return (
    <AppProviders store={store}>
      {probe}
      <RouterProvider router={router} />
    </AppProviders>
  );
}

function newRootStore(): RootStore {
  return new RootStore(createMemoryStorage());
}

function staffAccess(sub: string): string {
  return makeAccessToken({ sub, role: 'ADMIN', type: 'staff' });
}

function stubFetch(createResponse: () => Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockImplementation(() => Promise.resolve(createResponse()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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

function StoreProbe({ expected }: { expected: RootStore }) {
  const store = useRootStore();
  return (
    <span data-testid="store-probe">
      {store === expected ? 'same' : 'other'}
    </span>
  );
}

function ThemeProbe() {
  const current = useTheme();
  const matches = includesLocale(current, ruRU);
  return <span data-testid="theme-probe">{matches ? 'match' : 'miss'}</span>;
}

function includesLocale(value: unknown, expected: unknown): boolean {
  if (typeof expected === 'function') {
    return value === expected;
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(value) &&
      expected.every((item, index) => includesLocale(value[index], item))
    );
  }
  if (isRecord(expected)) {
    if (!isRecord(value)) {
      return false;
    }
    return Object.entries(expected).every(([key, item]) =>
      includesLocale(value[key], item),
    );
  }
  return value === expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
