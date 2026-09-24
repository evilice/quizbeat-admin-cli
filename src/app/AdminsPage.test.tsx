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
import { makeAccessToken } from '../stores/make-access-token.ts';
import { RootStore } from '../stores/root-store.ts';
import type { SessionStorage } from '../stores/session-store.ts';
import { AppProviders } from './App.tsx';
import { routes } from './routes.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('экран списка сотрудников', () => {
  it('первая загрузка без isActive, строка с isActive false видна', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        items: [
          sampleAdmin({
            id: 'a-1',
            email: 'alive@example.com',
            role: 'ADMIN',
            isActive: true,
          }),
          sampleAdmin({
            id: 'a-2',
            email: 'gone@example.com',
            role: 'SUPER_ADMIN',
            isActive: false,
          }),
        ],
        total: 2,
        page: 1,
        limit: 20,
      }),
    );
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('gone@example.com')).toBeTruthy();
    });

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.pathname).toBe('/admins');
    expect(firstUrl.searchParams.has('isActive')).toBe(false);
    expect(screen.getByText('неактивен')).toBeTruthy();
    expect(screen.getByText('Супер-админ')).toBeTruthy();
    expect(screen.getByText('alive@example.com')).toBeTruthy();
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

describe('создание сотрудника', () => {
  it('пароль из 7 символов не вызывает fetch', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        items: [sampleAdmin()],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('a@example.com')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: '1234567' },
    });
    submitCreateDialog();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/пароль должен быть не короче 8 символов/i),
    ).toBeTruthy();
  });

  it('отправка с ролью по умолчанию шлёт role ADMIN, email и password, не шлёт isActive', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(201, sampleAdmin({ id: 'created-1', email: 'new@example.com' })),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleAdmin()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('a@example.com')).toBeTruthy();
    });

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'password1' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0];
    expect(body).toEqual({
      email: 'new@example.com',
      password: 'password1',
      role: 'ADMIN',
    });
    expect(body).not.toHaveProperty('isActive');
  });

  it('201 закрывает диалог и вызывает повторное чтение списка', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(201, sampleAdmin({ id: 'created-1', email: 'new@example.com' })),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleAdmin()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('a@example.com')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'password1' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('409 показывает текст про занятый email и не запрашивает список заново', async () => {
    const conflictMessage = 'Admin with this email already exists';
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(409, {
            statusCode: 409,
            message: conflictMessage,
            error: 'Conflict',
            path: '/admins',
            timestamp: '2026-09-24T00:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          items: [sampleAdmin()],
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('a@example.com')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'password1' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.getByText(conflictMessage)).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(getListCalls(fetchMock)).toHaveLength(1);
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
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
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
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
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
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
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
    expect(
      within(row as HTMLElement).getByText('Супер-админ'),
    ).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('Админ')).toBeNull();
  });

  it('DELETE + 409 показывает текст про последнего супер-админа, подпись роли в строке не меняется', async () => {
    const admin = sampleAdmin({
      id: 'super-1',
      email: 'super@example.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
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
    expect(
      within(row as HTMLElement).getByText('Супер-админ'),
    ).toBeTruthy();
  });

  it('DELETE по своему id вызывает forgetRefresh, access на месте, запроса /auth/staff/refresh нет', async () => {
    const selfId = 'viewer-1';
    const admin = sampleAdmin({
      id: selfId,
      email: 'viewer@example.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
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
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
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
  });
});

describe('сброс пароля сотрудника', () => {
  it('пароль из 7 символов не вызывает fetch', async () => {
    const admin = sampleAdmin({
      id: 'other-1',
      email: 'other@example.com',
      role: 'ADMIN',
      isActive: true,
    });
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        items: [admin],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    renderAdmins();

    await waitFor(() => {
      expect(screen.getByText('other@example.com')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    openResetPasswordDialog(admin.email);
    fireEvent.change(screen.getByLabelText('Новый пароль'), {
      target: { value: '1234567' },
    });
    submitResetPasswordDialog();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/пароль должен быть не короче 8 символов/i),
    ).toBeTruthy();
  });

  it('отправка шлёт { newPassword } на /admins/<id>/password без currentPassword и без me', async () => {
    const admin = sampleAdmin({
      id: 'other-1',
      email: 'other@example.com',
      role: 'ADMIN',
      isActive: true,
    });
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && String(url).includes('/password')) {
        return Promise.resolve(new Response(null, { status: 204 }));
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

    openResetPasswordDialog(admin.email);
    fireEvent.change(screen.getByLabelText('Новый пароль'), {
      target: { value: 'password1' },
    });
    submitResetPasswordDialog();

    await waitFor(() => {
      expect(passwordPatchCalls(fetchMock)).toHaveLength(1);
    });

    const [url, init] = passwordPatchCalls(fetchMock)[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe(`/admins/${admin.id}/password`);
    expect(parsed.pathname).not.toContain('/me/');
    expect(parsed.pathname).not.toContain('/me');

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({ newPassword: 'password1' });
    expect(body).not.toHaveProperty('currentPassword');
    expect(body).not.toHaveProperty('password');
  });

  it('204 чужого id не вызывает forgetRefresh и не шлёт /auth/staff/refresh', async () => {
    const admin = sampleAdmin({
      id: 'other-1',
      email: 'other@example.com',
      role: 'ADMIN',
      isActive: true,
    });
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && String(url).includes('/password')) {
        return Promise.resolve(new Response(null, { status: 204 }));
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
      expect(screen.getByText('other@example.com')).toBeTruthy();
    });

    openResetPasswordDialog(admin.email);
    fireEvent.change(screen.getByLabelText('Новый пароль'), {
      target: { value: 'password1' },
    });
    submitResetPasswordDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('Пароль задан')).toBeTruthy();
    expect(store.session.refreshToken).toBe('refresh-1');
    expect(store.session.accessToken).toBe(accessBefore);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/auth/staff/refresh'),
      ),
    ).toBe(false);
  });

  it('204 своего id вызывает forgetRefresh, access остаётся', async () => {
    const selfId = 'viewer-1';
    const admin = sampleAdmin({
      id: selfId,
      email: 'viewer@example.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && String(url).includes('/password')) {
        return Promise.resolve(new Response(null, { status: 204 }));
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

    openResetPasswordDialog(admin.email);
    fireEvent.change(screen.getByLabelText('Новый пароль'), {
      target: { value: 'password1' },
    });
    submitResetPasswordDialog();

    await waitFor(() => {
      expect(store.session.refreshToken).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(store.session.accessToken).toBe(accessBefore);
    expect(screen.getByText('Пароль задан')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/auth/staff/refresh'),
      ),
    ).toBe(false);
  });
});

function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
}

function submitCreateDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
}

function openResetPasswordDialog(email: string) {
  const row = screen.getByText(email).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Сбросить пароль' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
}

function submitResetPasswordDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Сбросить пароль' }),
  );
}

function passwordPatchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method;
    return method === 'PATCH' && url.includes('/password');
  });
}

function getListCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return url.includes('/admins') && method === 'GET';
  });
}

function mutationCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
    return method !== 'GET';
  });
}

function deleteCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
  );
}

function postBodies(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return typeof body === 'string' ? (JSON.parse(body) as unknown) : body;
    });
}

function patchBodies(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return typeof body === 'string' ? (JSON.parse(body) as unknown) : body;
    });
}

function renderAdmins({
  role = 'SUPER_ADMIN',
}: {
  role?: 'ADMIN' | 'SUPER_ADMIN';
} = {}) {
  const store = new RootStore(createMemoryStorage());
  store.session.setPair(
    makeAccessToken({ sub: 'viewer-1', role, type: 'staff' }),
    'refresh-1',
    'viewer@example.com',
  );
  const router = createMemoryRouter(routes, { initialEntries: ['/admins'] });
  const view = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, store };
}

function sampleAdmin(overrides: {
  id?: string;
  email?: string;
  role?: 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
} = {}) {
  return {
    id: overrides.id ?? 'admin-id',
    email: overrides.email ?? 'a@example.com',
    role: overrides.role ?? 'ADMIN',
    isActive: overrides.isActive ?? true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
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
