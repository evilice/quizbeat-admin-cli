import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openResetPasswordDialog,
  submitResetPasswordDialog,
  passwordPatchCalls,
  renderAdmins,
  sampleAdmin,
  stubFetch,
  jsonResponse,
} from '../admins-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
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
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
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
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
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
