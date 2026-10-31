import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getArtistsListCalls,
  jsonResponse,
  openCreateDialog,
  openEditDialog,
  patchBodies,
  postBodies,
  renderArtists,
  sampleArtist,
  stubFetch,
  submitCreateDialog,
  submitEditDialog,
} from '../artists-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('создание и правка исполнителя', () => {
  it('пустое имя не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    submitCreateDialog();
    submitCreateDialog();

    expect(screen.getByText('Укажите имя')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('имя из одних пробелов не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: '   ' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите имя')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('пустое имя при переименовании не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openEditDialog('Queen');
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: '   ' },
    });
    submitEditDialog();

    expect(screen.getByText('Укажите имя')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(patchBodies(fetchMock)).toHaveLength(0);
  });

  it('создание отправляет имя после trim и перечитывает список', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(201, sampleArtist({ id: 'created-1', name: 'Jazz' })),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleArtist()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: '  Jazz  ' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });
    expect(postBodies(fetchMock)[0]).toEqual({ name: 'Jazz' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getArtistsListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('правка открывается с текущим именем, показывает подсказку и шлёт PATCH', async () => {
    const existing = sampleArtist({ id: 'artist-1', name: 'Queen' });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve(
            jsonResponse(200, { ...existing, name: 'Queen!' }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [existing],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);

    openEditDialog('Queen');
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', 'Queen');
    expect(screen.getByText('Имя изменится у всех композиций')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: '  Queen!  ' },
    });
    submitEditDialog();

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });

    const [url, body] = patchBodies(fetchMock)[0]!;
    expect(new URL(String(url)).pathname).toBe(`/artists/${existing.id}`);
    expect(body).toEqual({ name: 'Queen!' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getArtistsListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('409 при создании показывает message в диалоге, значения не сбрасываются', async () => {
    const conflictMessage = 'Artist with this name already exists';
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(409, {
              statusCode: 409,
              message: conflictMessage,
              error: 'Conflict',
              path: '/artists',
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleArtist()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: 'Queen' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog')).getByText(conflictMessage),
      ).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', 'Queen');
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);
  });

  it('409 при переименовании показывает message и не закрывает диалог', async () => {
    const conflictMessage = 'Artist with this name already exists';
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve(
            jsonResponse(409, {
              statusCode: 409,
              message: conflictMessage,
              error: 'Conflict',
              path: '/artists/artist-1',
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleArtist({ id: 'artist-1' })],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderArtists();

    await waitFor(() => {
      expect(screen.getByText('Queen')).toBeTruthy();
    });
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);

    openEditDialog('Queen');
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: 'Queen!' },
    });
    submitEditDialog();

    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog')).getByText(conflictMessage),
      ).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', 'Queen!');
    expect(getArtistsListCalls(fetchMock)).toHaveLength(1);
  });
});

const stubListOnlyFetch = () => {
  return stubFetch(() =>
    jsonResponse(200, {
      items: [sampleArtist()],
      total: 1,
      page: 1,
      limit: 20,
    }),
  );
};
