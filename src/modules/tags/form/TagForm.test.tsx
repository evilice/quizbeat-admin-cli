import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getListCalls,
  jsonResponse,
  renderTags,
  sampleTag,
  stubFetch,
} from '../tags-test-helpers.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('создание и правка тега', () => {
  it('пустое en при заполненных коде и ru не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите название (en)')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('код из одних пробелов не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите код')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('пустое ru при заполненных коде и en не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите название (ru)')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('пустой код при заполненных названиях не вызывает fetch', async () => {
    const fetchMock = stubListOnlyFetch();
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    expect(screen.getByText('Укажите код')).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('создание шлёт две локали с полем name и не шлёт text', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              201,
              sampleTag({
                id: 'created-1',
                code: 'jazz',
                translations: [
                  { locale: 'ru', name: 'Джаз' },
                  { locale: 'en', name: 'Jazz' },
                ],
              }),
            ),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleTag()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(postBodies(fetchMock)).toHaveLength(1);
    });

    const body = postBodies(fetchMock)[0]!;
    expect(body).toEqual({
      code: 'jazz',
      translations: [
        { locale: 'ru', name: 'Джаз' },
        { locale: 'en', name: 'Jazz' },
      ],
    });
    expect(body).not.toHaveProperty('text');
    expect(
      (body.translations as { text?: unknown }[]).every(
        (item) => !Object.hasOwn(item, 'text'),
      ),
    ).toBe(true);
  });

  it('правка с изменённым только ru шлёт и ru, и en', async () => {
    const existing = sampleTag({
      id: 'tag-1',
      code: 'rock',
      translations: [
        { locale: 'en', name: 'Rock' },
        { locale: 'ru', name: 'Рок' },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve(
            jsonResponse(200, {
              ...existing,
              translations: [
                { locale: 'ru', name: 'Рок-н-ролл' },
                { locale: 'en', name: 'Rock' },
              ],
            }),
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
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    openEditDialog('rock');
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Рок-н-ролл' },
    });
    submitEditDialog();

    await waitFor(() => {
      expect(patchBodies(fetchMock)).toHaveLength(1);
    });

    const [url, body] = patchBodies(fetchMock)[0]!;
    expect(new URL(String(url)).pathname).toBe(`/tags/${existing.id}`);
    expect(body).toEqual({
      code: 'rock',
      translations: [
        { locale: 'ru', name: 'Рок-н-ролл' },
        { locale: 'en', name: 'Rock' },
      ],
    });
  });

  it('201 закрывает диалог и вызывает повторное чтение списка', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              201,
              sampleTag({
                id: 'created-1',
                code: 'jazz',
                translations: [
                  { locale: 'ru', name: 'Джаз' },
                  { locale: 'en', name: 'Jazz' },
                ],
              }),
            ),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleTag()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(getListCalls(fetchMock)).toHaveLength(2);
    });
  });

  it('ошибка без текста сохранения показывает общую заглушку, диалог остаётся', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(new Response('', { status: 500 }));
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleTag()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'jazz' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Джаз' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Jazz' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.getByText('Непредвиденная ошибка')).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Код')).toHaveProperty('value', 'jazz');
    expect(getListCalls(fetchMock)).toHaveLength(1);
  });

  it('409 с текстом про занятый код показывает строку и не запрашивает список заново', async () => {
    const conflictMessage = 'Tag with this code already exists';
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(409, {
              statusCode: 409,
              message: conflictMessage,
              error: 'Conflict',
              path: '/tags',
              timestamp: '2026-09-24T00:00:00.000Z',
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            items: [sampleTag()],
            total: 1,
            page: 1,
            limit: 20,
          }),
        );
      });
    vi.stubGlobal('fetch', fetchMock);
    renderTags();

    await waitFor(() => {
      expect(screen.getByText('rock')).toBeTruthy();
    });
    expect(getListCalls(fetchMock)).toHaveLength(1);

    openCreateDialog();
    fireEvent.change(screen.getByLabelText('Код'), {
      target: { value: 'rock' },
    });
    fireEvent.change(screen.getByLabelText('Название (ru)'), {
      target: { value: 'Рок' },
    });
    fireEvent.change(screen.getByLabelText('Название (en)'), {
      target: { value: 'Rock' },
    });
    submitCreateDialog();

    await waitFor(() => {
      expect(screen.getByText(conflictMessage)).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Код')).toHaveProperty('value', 'rock');
    expect(screen.getByLabelText('Название (ru)')).toHaveProperty(
      'value',
      'Рок',
    );
    expect(screen.getByLabelText('Название (en)')).toHaveProperty(
      'value',
      'Rock',
    );
    expect(getListCalls(fetchMock)).toHaveLength(1);
  });
});

const openCreateDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
};

const submitCreateDialog = () => {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
};

const openEditDialog = (code: string) => {
  const row = screen.getByText(code).closest('tr');
  expect(row).toBeTruthy();
  fireEvent.click(
    within(row as HTMLElement).getByRole('button', { name: 'Изменить' }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
};

const submitEditDialog = () => {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
};

const stubListOnlyFetch = () => {
  return stubFetch(() =>
    jsonResponse(200, {
      items: [sampleTag()],
      total: 1,
      page: 1,
      limit: 20,
    }),
  );
};

const postBodies = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map((call) => {
      const body = (call[1] as RequestInit).body;
      return JSON.parse(typeof body === 'string' ? body : '') as Record<
        string,
        unknown
      >;
    });
};

const patchBodies = (fetchMock: ReturnType<typeof vi.fn>) => {
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((call) => {
      const init = call[1] as RequestInit;
      const body = init.body;
      return [
        call[0],
        JSON.parse(typeof body === 'string' ? body : '') as Record<
          string,
          unknown
        >,
      ] as const;
    });
};
