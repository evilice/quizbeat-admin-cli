import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-error.ts';
import {
  listPresentation,
  useListQuery,
  type PaginatedResult,
} from './use-list-query.ts';

const pageOf = (
  page: number,
  items: string[],
  total = items.length,
): PaginatedResult<string> => ({ items, total, page, limit: 2 });

describe('useListQuery', () => {
  it('грузит страницу и считает число страниц', async () => {
    const fetchPage = vi.fn().mockResolvedValue(pageOf(1, ['a', 'b'], 5));

    const { result } = renderHook(() =>
      useListQuery({ params: { q: '' }, fetchPage }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.items).toEqual(['a', 'b']);
    expect(result.current.totalPages).toBe(3);
    expect(fetchPage).toHaveBeenCalledWith({ q: '' }, 1);
  });

  it('следующая страница, возврат на первую и перезагрузка шлют новые запросы', async () => {
    const fetchPage = vi
      .fn()
      .mockImplementation((_: unknown, page: number) =>
        Promise.resolve(pageOf(page, [`p${page}`], 6)),
      );
    const { result } = renderHook(() =>
      useListQuery({ params: {}, fetchPage }),
    );
    await waitFor(() => {
      expect(result.current.items).toEqual(['p1']);
    });

    act(() => {
      result.current.goToNextPage();
    });
    await waitFor(() => {
      expect(result.current.items).toEqual(['p2']);
    });

    act(() => {
      result.current.resetPage();
    });
    await waitFor(() => {
      expect(result.current.items).toEqual(['p1']);
    });

    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(fetchPage).toHaveBeenCalledTimes(4);
    });
  });

  it('ответ на устаревший запрос отбрасывается', async () => {
    const resolvers: Array<(value: PaginatedResult<string>) => void> = [];
    const fetchPage = vi.fn().mockImplementation(
      () =>
        new Promise<PaginatedResult<string>>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { result, rerender } = renderHook(
      ({ q }) => useListQuery({ params: { q }, fetchPage }),
      { initialProps: { q: 'a' } },
    );

    rerender({ q: 'ab' });
    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });
    await act(async () => {
      resolvers[1]?.(pageOf(1, ['new']));
      resolvers[0]?.(pageOf(1, ['old']));
      await Promise.resolve();
    });

    expect(result.current.items).toEqual(['new']);
  });

  it('ошибка списка даёт сообщение и пустой результат', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new ApiError(500, []));
    const { result } = renderHook(() =>
      useListQuery({ params: {}, fetchPage }),
    );

    await waitFor(() => {
      expect(result.current.listMessages).toEqual(['Непредвиденная ошибка']);
    });
    expect(result.current.result).toBeNull();
  });

  it('refreshCurrentPage обновляет страницу и возвращает текст ошибки', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf(1, ['a', 'b']))
      .mockResolvedValueOnce(pageOf(1, ['a']))
      .mockRejectedValueOnce(new ApiError(500, ['boom']));
    const { result } = renderHook(() =>
      useListQuery({ params: {}, fetchPage }),
    );
    await waitFor(() => {
      expect(result.current.items).toEqual(['a', 'b']);
    });

    let first: readonly string[] | null = ['x'];
    await act(async () => {
      first = await result.current.refreshCurrentPage();
    });
    expect(first).toBeNull();
    expect(result.current.items).toEqual(['a']);

    let second: readonly string[] | null = null;
    await act(async () => {
      second = await result.current.refreshCurrentPage();
    });
    expect(second).toEqual(['boom']);
    expect(result.current.loading).toBe(false);
  });
});

describe('listPresentation', () => {
  it('пустая страница без ошибок — «пусто», без таблицы и пагинации', () => {
    expect(
      listPresentation({
        result: pageOf(1, [], 0),
        loading: false,
        hasError: false,
      }),
    ).toEqual({ showEmpty: true, showTable: false, showPagination: false });
  });

  it('таблица остаётся при ошибке действия', () => {
    expect(
      listPresentation({
        result: pageOf(1, ['a'], 1),
        loading: false,
        hasError: true,
      }),
    ).toEqual({ showEmpty: false, showTable: true, showPagination: true });
  });

  it('без результата ничего не показывается', () => {
    expect(
      listPresentation({ result: null, loading: false, hasError: true }),
    ).toEqual({ showEmpty: false, showTable: false, showPagination: false });
  });
});
