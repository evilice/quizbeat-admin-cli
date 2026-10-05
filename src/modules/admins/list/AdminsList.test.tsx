import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mutationCalls,
  deleteCalls,
  patchBodies,
  renderAdmins,
  sampleAdmin,
  stubFetch,
  jsonResponse,
} from '../admins-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('экран списка сотрудников', () => {
  it('первая загрузка с isActive=true, фильтр стоит на «только активные»', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        items: [
          sampleAdmin({
            id: 'a-1',
            email: 'alive@example.com',
            role: 'ADMIN',
            isActive: true,
          }),
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('alive@example.com')).toBeTruthy();
    });

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.pathname).toBe('/admins');
    expect(firstUrl.searchParams.get('isActive')).toBe('true');
    expect(screen.getByLabelText('Активность').textContent).toContain(
      'Только активные',
    );
    expect(screen.getByText('активен')).toBeTruthy();
    expect(screen.getByText('Админ')).toBeTruthy();
  });

  it('выбор «только неактивные» даёт isActive=false и сбрасывает страницу на 1', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      if (!parsed.pathname.endsWith('/admins')) {
        return Promise.resolve(jsonResponse(500, { message: 'unexpected' }));
      }
      const page = Number(parsed.searchParams.get('page') ?? '1');
      if (parsed.searchParams.get('isActive') === 'false') {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              sampleAdmin({
                id: 'inactive-1',
                email: 'off@example.com',
                isActive: false,
              }),
            ],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [
            sampleAdmin({
              id: `page-${page}`,
              email: `page${page}@example.com`,
              isActive: true,
            }),
          ],
          total: 40,
          page,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('page1@example.com')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    await waitFor(() => {
      expect(screen.getByText('page2@example.com')).toBeTruthy();
    });
    expect(
      new URL(String(fetchMock.mock.calls.at(-1)?.[0])).searchParams.get(
        'page',
      ),
    ).toBe('2');

    fireEvent.mouseDown(screen.getByLabelText('Активность'));
    fireEvent.click(screen.getByRole('option', { name: 'Только неактивные' }));

    await waitFor(() => {
      expect(screen.getByText('off@example.com')).toBeTruthy();
    });

    const lastUrl = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
    expect(lastUrl.searchParams.get('isActive')).toBe('false');
    expect(lastUrl.searchParams.get('page')).toBe('1');
  });

  it('пустой 200 и 403 различаются', async () => {
    const emptyFetch = stubFetch(() =>
      jsonResponse(200, {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
    );
    const { unmount } = renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('Никого не найдено')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
    expect(emptyFetch).toHaveBeenCalledTimes(1);
    unmount();
    cleanup();
    vi.unstubAllGlobals();

    const forbidMessage = 'Forbidden resource';
    stubFetch(() =>
      jsonResponse(403, {
        statusCode: 403,
        message: forbidMessage,
        error: 'Forbidden',
        path: '/admins',
        timestamp: '2026-09-24T00:00:00.000Z',
      }),
    );
    renderAdmins({ role: 'ADMIN' });

    await waitFor(() => {
      expect(screen.getByText(forbidMessage)).toBeTruthy();
    });
    expect(screen.queryByText('Никого не найдено')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('роль, деактивация и активация', () => {
  const LAST_SUPER_ADMIN_MESSAGE =
    'Cannot deactivate or demote the last active SUPER_ADMIN';

  it('подтверждённая деактивация шлёт DELETE и не шлёт PATCH с isActive: false; отмена не шлёт ничего', async () => {
    const admin = sampleAdmin({
      id: 'other-1',
      email: 'other@example.com',
      role: 'ADMIN',
      isActive: true,
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(200, { ...admin, isActive: false }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [admin],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('other@example.com')).toBeTruthy();
    });
    const callsAfterLoad = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Деактивировать' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
    expect(mutationCalls(fetchMock)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Деактивировать' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Деактивировать',
      }),
    );

    await waitFor(() => {
      expect(deleteCalls(fetchMock)).toHaveLength(1);
    });
    expect(String(deleteCalls(fetchMock)[0]?.[0])).toContain(
      `/admins/${admin.id}`,
    );
    expect(
      patchBodies(fetchMock).some(
        (body) =>
          typeof body === 'object' &&
          body !== null &&
          'isActive' in body &&
          (body as { isActive: unknown }).isActive === false,
      ),
    ).toBe(false);
  });

  it('активация шлёт PATCH с boolean true', async () => {
    const admin = sampleAdmin({
      id: 'off-1',
      email: 'off@example.com',
      role: 'ADMIN',
      isActive: false,
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve(
            jsonResponse(200, { ...admin, isActive: true }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [admin],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('off@example.com')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Активировать' }));

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });
    expect(patchBodies(fetchMock)[0]).toEqual({ isActive: true });
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('409 показывает текст про последнего супер-админа, подпись роли в строке не меняется', async () => {
    const admin = sampleAdmin({
      id: 'super-1',
      email: 'super@example.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve(
            jsonResponse(409, {
              statusCode: 409,
              message: LAST_SUPER_ADMIN_MESSAGE,
              error: 'Conflict',
              path: `/admins/${admin.id}`,
              timestamp: '2026-09-24T00:00:00.000Z',
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [admin],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('super@example.com')).toBeTruthy();
    });

    const row = screen.getByText('super@example.com').closest('tr');
    expect(row).toBeTruthy();
    fireEvent.mouseDown(
      within(row as HTMLElement).getByLabelText('Роль сотрудника'),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Админ' }));

    await waitFor(() => {
      expect(screen.getByText(LAST_SUPER_ADMIN_MESSAGE)).toBeTruthy();
    });
    expect(within(row as HTMLElement).getByText('Супер-админ')).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('Админ')).toBeNull();
  });

  it('DELETE + 409 показывает текст про последнего супер-админа, подпись роли в строке не меняется', async () => {
    const admin = sampleAdmin({
      id: 'super-1',
      email: 'super@example.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(409, {
              statusCode: 409,
              message: LAST_SUPER_ADMIN_MESSAGE,
              error: 'Conflict',
              path: `/admins/${admin.id}`,
              timestamp: '2026-09-24T00:00:00.000Z',
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [admin],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('super@example.com')).toBeTruthy();
    });

    const row = screen.getByText('super@example.com').closest('tr');
    expect(row).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Деактивировать' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Деактивировать',
      }),
    );

    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog')).getByText(LAST_SUPER_ADMIN_MESSAGE),
      ).toBeTruthy();
    });
    expect(screen.getByText('активен')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Супер-админ')).toBeTruthy();
  });

  it('DELETE по своему id вызывает forgetRefresh, access на месте, запроса /auth/staff/refresh нет', async () => {
    const selfId = 'viewer-1';
    const admin = sampleAdmin({
      id: selfId,
      email: 'viewer@example.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (method === 'DELETE') {
          return Promise.resolve(
            jsonResponse(200, { ...admin, isActive: false }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [admin],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    const { store } = renderAdmins();
    const accessBefore = store.session.accessToken;

    await waitFor(() => {
      expect(screen.getByText('viewer@example.com')).toBeTruthy();
    });
    expect(store.session.refreshToken).toBe('refresh-1');

    fireEvent.click(screen.getByRole('button', { name: 'Деактивировать' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Деактивировать',
      }),
    );

    await waitFor(() => {
      expect(store.session.refreshToken).toBeNull();
    });
    expect(store.session.accessToken).toBe(accessBefore);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/auth/staff/refresh'),
      ),
    ).toBe(false);
  });

  it('успешный PATCH роли forgetRefresh не вызывает', async () => {
    const admin = sampleAdmin({
      id: 'viewer-1',
      email: 'viewer@example.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve(
            jsonResponse(200, { ...admin, role: 'ADMIN' }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [admin],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    const { store } = renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('viewer@example.com')).toBeTruthy();
    });

    const row = screen.getByText('viewer@example.com').closest('tr');
    fireEvent.mouseDown(
      within(row as HTMLElement).getByLabelText('Роль сотрудника'),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Админ' }));

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });
    expect(patchBodies(fetchMock)[0]).toEqual({ role: 'ADMIN' });
    expect(store.session.refreshToken).toBe('refresh-1');
    expect(store.session.role).toBe('SUPER_ADMIN');
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('смена роли другого сотрудника не показывает уведомление', async () => {
    const admin = sampleAdmin({ id: 'other-1', email: 'other@example.com' });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? jsonResponse(200, { ...admin, role: 'SUPER_ADMIN' })
            : jsonResponse(200, {
                items: [admin],
                total: 1,
                page: 1,
                limit: 20,
              }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();
    await waitFor(() => {
      expect(screen.getByText('other@example.com')).toBeTruthy();
    });

    const row = screen.getByText('other@example.com').closest('tr');
    fireEvent.mouseDown(
      within(row as HTMLElement).getByLabelText('Роль сотрудника'),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Супер-админ' }));

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('поиск уходит одним запросом после паузы ввода, строка триммится', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, { items: [], total: 0, page: 1, limit: 20 }),
    );
    renderAdmins();
    await screen.findByText('Никого не найдено');
    const initialCalls = fetchMock.mock.calls.length;

    const input = screen.getByLabelText('Поиск по email');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab ' } });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBe(initialCalls + 1);
    });
    const url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
    expect(url.searchParams.get('search')).toBe('ab');
  });

  it('сетевая ошибка действия показывает сообщение вместо тишины', async () => {
    const admin = sampleAdmin({
      id: 'off-1',
      email: 'off@example.com',
      isActive: false,
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) =>
        init?.method === 'PATCH'
          ? Promise.reject(new Error('boom'))
          : Promise.resolve(
              jsonResponse(200, {
                items: [admin],
                total: 1,
                page: 1,
                limit: 20,
              }),
            ),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();
    await screen.findByText('off@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(
      await screen.findByText('Не удалось связаться с сервером'),
    ).toBeTruthy();
  });
});
