import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCompositionListCalls,
  jsonResponse,
  openCreateDialog,
  postBodies,
  renderCompositions,
  sampleComposition,
  sampleTag,
  stubListFetch,
  submitCreateDialog,
} from '../compositions-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('создание композиции', () => {
  it('пустое название при заполненном авторе не вызывает fetch', async () => {
    const fetchMock = stubListFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(
      within(screen.getByRole('dialog')).getByLabelText('Автор'),
      {
        target: { value: 'Author' },
      },
    );
    submitCreateDialog();

    expect(screen.getByText('Укажите название')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('название из одних пробелов не вызывает fetch', async () => {
    const fetchMock = stubListFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Название'), {
      target: { value: '   ' },
    });
    fireEvent.change(dialog.getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите название')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('пустой автор при заполненном названии не вызывает fetch', async () => {
    const fetchMock = stubListFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(
      within(screen.getByRole('dialog')).getByLabelText('Название'),
      { target: { value: 'New Song' } },
    );
    submitCreateDialog();

    expect(screen.getByText('Укажите автора')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('создание без смены статуса не содержит ключ status; без тегов — без tagIds', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              201,
              sampleComposition({ id: 'created-1', title: 'New' }),
            ),
          );
        }
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleComposition()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'New Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'New Author' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0];
    expect(body).toEqual({ title: 'New Song', author: 'New Author' });
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('tagIds');
  });

  it('создание с выбором «Опубликована» шлёт status PUBLISHED; с двумя тегами — массив uuid', async () => {
    const tagA = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440001',
      code: 'rock',
      translations: [
        { locale: 'ru', name: 'Рок' },
        { locale: 'en', name: 'Rock' },
      ],
    });
    const tagB = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440002',
      code: 'jazz',
      translations: [
        { locale: 'ru', name: 'Джаз' },
        { locale: 'en', name: 'Jazz' },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              201,
              sampleComposition({
                id: 'created-1',
                title: 'Published',
                status: 'PUBLISHED',
                tags: [tagA, tagB],
              }),
            ),
          );
        }
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, {
              items: [tagA, tagB],
              total: 2,
              page: 1,
              limit: 100,
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleComposition()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes('/tags')),
      ).toBe(true);
    });

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'Published Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    fireEvent.mouseDown(within(dialog).getByLabelText('Статус'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Опубликована' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Опубликована' }));

    fireEvent.mouseDown(within(dialog).getByLabelText('Теги'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Рок' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Рок' }));
    fireEvent.click(screen.getByRole('option', { name: 'Джаз' }));
    // close the multi-select menu so submit is reachable
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0];
    expect(body).toEqual({
      title: 'Published Song',
      author: 'Author',
      status: 'PUBLISHED',
      tagIds: [tagA.id, tagB.id],
    });
    expect(Array.isArray(body.tagIds)).toBe(true);
    expect(typeof body.tagIds).not.toBe('string');
  });

  it('201 закрывает диалог и вызывает повторное чтение списка', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              201,
              sampleComposition({ id: 'created-1', title: 'New' }),
            ),
          );
        }
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, { items: [], total: 0, page: 1, limit: 100 }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleComposition()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'New Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getCompositionListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('400 с текстом про неизвестный тег показывает строку и не запрашивает список заново', async () => {
    const unknownTagMessage =
      'One or more tagIds do not reference an existing tag';
    const tagA = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440099',
      code: 'ghost',
      translations: [
        { locale: 'ru', name: 'Призрак' },
        { locale: 'en', name: 'Ghost' },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(400, {
              statusCode: 400,
              message: unknownTagMessage,
              error: 'Bad Request',
              path: '/compositions',
              timestamp: '2026-09-25T00:00:00.000Z',
            }),
          );
        }
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/tags')) {
          return Promise.resolve(
            jsonResponse(200, {
              items: [tagA],
              total: 1,
              page: 1,
              limit: 100,
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleComposition()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'Song' },
    });
    fireEvent.change(within(dialog).getByLabelText('Автор'), {
      target: { value: 'Author' },
    });
    fireEvent.mouseDown(within(dialog).getByLabelText('Теги'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Призрак' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Призрак' }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog')).getByText(unknownTagMessage),
      ).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);
  });
});
