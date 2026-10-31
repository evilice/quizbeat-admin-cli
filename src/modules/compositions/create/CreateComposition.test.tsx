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
  sampleArtist,
  sampleComposition,
  sampleTag,
  submitCreateDialog,
} from '../compositions-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('создание композиции', () => {
  it('пустое название не вызывает fetch', async () => {
    const fetchMock = stubCreateFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    submitCreateDialog();

    expect(screen.getByText('Укажите название')).toBeTruthy();
    expect(screen.queryByText('Укажите автора')).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('название из одних пробелов не вызывает fetch', async () => {
    const fetchMock = stubCreateFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(
      within(screen.getByRole('dialog')).getByLabelText('Название'),
      { target: { value: '   ' } },
    );
    submitCreateDialog();

    expect(screen.getByText('Укажите название')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('создание без исполнителей не содержит artistIds, status и tagIds', async () => {
    const fetchMock = stubCreateFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });

    openCreateDialog();
    fireEvent.change(
      within(screen.getByRole('dialog')).getByLabelText('Название'),
      { target: { value: 'New Song' } },
    );
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0];
    expect(body).toEqual({ title: 'New Song' });
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('tagIds');
    expect(body).not.toHaveProperty('artistIds');
  });

  it('публикация без исполнителей допустима', async () => {
    const fetchMock = stubCreateFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });

    openCreateDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'Folk Song' },
    });
    fireEvent.mouseDown(within(dialog).getByLabelText('Статус'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Опубликована' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Опубликована' }));
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0];
    expect(body).toEqual({ title: 'Folk Song', status: 'PUBLISHED' });
    expect(body).not.toHaveProperty('artistIds');
  });

  it('два исполнителя уходят artistIds в порядке выбора; теги — массивом uuid', async () => {
    const queen = sampleArtist({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Queen',
    });
    const adam = sampleArtist({
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Adam Lambert',
    });
    const tagA = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440011',
      code: 'rock',
      translations: [
        { locale: 'ru', name: 'Рок' },
        { locale: 'en', name: 'Rock' },
      ],
    });
    const tagB = sampleTag({
      id: '550e8400-e29b-41d4-a716-446655440012',
      code: 'jazz',
      translations: [
        { locale: 'ru', name: 'Джаз' },
        { locale: 'en', name: 'Jazz' },
      ],
    });
    const fetchMock = stubCreateFetch({
      artists: [queen, adam],
      tags: [tagA, tagB],
    });
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
    const artistsInput = within(dialog).getByLabelText('Исполнители');
    fireEvent.focus(artistsInput);
    fireEvent.change(artistsInput, { target: { value: 'a' } });
    fireEvent.click(
      await screen.findByRole(
        'option',
        {
          name: 'Adam Lambert',
        },
        { timeout: 3000 },
      ),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Queen' }));

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
      artistIds: [adam.id, queen.id],
      status: 'PUBLISHED',
      tagIds: [tagA.id, tagB.id],
    });
    expect(Array.isArray(body.artistIds)).toBe(true);
    expect(typeof body.tagIds).not.toBe('string');
  });

  it('201 закрывает диалог и вызывает повторное чтение списка', async () => {
    const fetchMock = stubCreateFetch();
    renderCompositions();

    await waitFor(() => {
      expect(screen.getByText('Song One')).toBeTruthy();
    });
    expect(getCompositionListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(
      within(screen.getByRole('dialog')).getByLabelText('Название'),
      { target: { value: 'New Song' } },
    );
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
    const fetchMock = stubCreateFetch({
      tags: [tagA],
      createStatus: 400,
      createBody: {
        statusCode: 400,
        message: unknownTagMessage,
        error: 'Bad Request',
        path: '/compositions',
        timestamp: '2026-09-25T00:00:00.000Z',
      },
    });
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

const stubCreateFetch = ({
  artists = [] as ReturnType<typeof sampleArtist>[],
  tags = [] as ReturnType<typeof sampleTag>[],
  createStatus = 201,
  createBody,
}: {
  artists?: ReturnType<typeof sampleArtist>[];
  tags?: ReturnType<typeof sampleTag>[];
  createStatus?: number;
  createBody?: unknown;
} = {}) => {
  const fetchMock = vi
    .fn()
    .mockImplementation((url: string, init?: RequestInit) => {
      const parsed = new URL(String(url));
      const method = init?.method ?? 'GET';
      if (method === 'POST' && parsed.pathname === '/compositions') {
        return Promise.resolve(
          jsonResponse(
            createStatus,
            createBody ?? sampleComposition({ id: 'created-1', title: 'New' }),
          ),
        );
      }
      if (method === 'GET' && parsed.pathname === '/tags') {
        return Promise.resolve(
          jsonResponse(200, {
            items: tags,
            total: tags.length,
            page: 1,
            limit: 100,
          }),
        );
      }
      if (method === 'GET' && parsed.pathname === '/artists') {
        return Promise.resolve(
          jsonResponse(200, {
            items: artists,
            total: artists.length,
            page: 1,
            limit: 20,
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
  return fetchMock;
};
