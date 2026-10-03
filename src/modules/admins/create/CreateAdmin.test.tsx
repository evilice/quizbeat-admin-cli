import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openCreateDialog,
  submitCreateDialog,
  getListCalls,
  postBodies,
  renderAdmins,
  sampleAdmin,
  stubFetch,
  jsonResponse,
} from '../admins-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              201,
              sampleAdmin({ id: 'created-1', email: 'new@example.com' }),
            ),
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
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              201,
              sampleAdmin({ id: 'created-1', email: 'new@example.com' }),
            ),
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
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
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
