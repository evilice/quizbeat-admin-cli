import { useEffect, useRef, useState } from 'react';
import { messagesFromError } from '../api/api-error.ts';

const DEFAULT_PAGE_LIMIT = 20;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type ListState<T> = {
  key: string;
  result: PaginatedResult<T> | null;
  messages: readonly string[];
};

type ListQueryOptions<TParams, T> = {
  /** Фильтры без страницы. Смена значения (по JSON) запускает новый запрос. */
  params: TParams;
  fetchPage: (params: TParams, page: number) => Promise<PaginatedResult<T>>;
};

/**
 * Состояние постраничного списка: номер страницы, запрос, устаревшие ответы,
 * ошибка списка. Фильтры, действия над строками и тексты действий остаются
 * в экране; при смене фильтра экран вызывает `resetPage`.
 */
export const useListQuery = <TParams, T>({
  params,
  fetchPage,
}: ListQueryOptions<TParams, T>) => {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [listState, setListState] = useState<ListState<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const requestKey = JSON.stringify([params, page, version]);
  const latest = useRef({ params, fetchPage, requestKey });
  useEffect(() => {
    latest.current = { params, fetchPage, requestKey };
  });

  useEffect(() => {
    let cancelled = false;
    const { params: currentParams, fetchPage: fetchCurrent } = latest.current;

    void fetchCurrent(currentParams, page)
      .then((result) => {
        if (!cancelled) {
          setListState({ key: requestKey, result, messages: [] });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setListState({
            key: requestKey,
            result: null,
            messages: messagesFromError(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, page]);

  const loading = listState?.key !== requestKey || refreshing;
  const listMessages = loading ? [] : (listState?.messages ?? []);
  const result = listState?.result ?? null;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const limit = result?.limit ?? DEFAULT_PAGE_LIMIT;

  /**
   * Тихо перечитывает текущую страницу (строку уже удалили на сервере).
   * Ответ отбрасывается, если за это время фильтры или страница сменились.
   * Возвращает тексты ошибки или `null`.
   */
  const refreshCurrentPage = async (): Promise<readonly string[] | null> => {
    const startedKey = requestKey;
    setRefreshing(true);
    try {
      const refreshed = await fetchPage(params, page);
      if (latest.current.requestKey === startedKey) {
        setListState({ key: startedKey, result: refreshed, messages: [] });
      }
      return null;
    } catch (error) {
      return messagesFromError(error);
    } finally {
      setRefreshing(false);
    }
  };

  return {
    result,
    items,
    total,
    loading,
    listMessages,
    currentPage: result?.page ?? page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    reload: () => {
      setVersion((current) => current + 1);
    },
    resetPage: () => {
      setPage(1);
    },
    goToPreviousPage: () => {
      setPage((current) => Math.max(1, current - 1));
    },
    goToNextPage: () => {
      setPage((current) => current + 1);
    },
    refreshCurrentPage,
  };
};

/**
 * Что показывать под фильтрами: `hasError` считает экран (список + действия).
 * Таблица остаётся при ошибке действия (409): `result` не сбрасывается.
 * При ошибке самого списка (403) `result = null`, таблицы нет.
 */
export const listPresentation = ({
  result,
  loading,
  hasError,
}: {
  result: PaginatedResult<unknown> | null;
  loading: boolean;
  hasError: boolean;
}) => {
  const itemCount = result?.items.length ?? 0;
  const showTable = itemCount > 0;
  return {
    showEmpty: !loading && !hasError && result !== null && itemCount === 0,
    showTable,
    showPagination:
      showTable || (!hasError && result !== null && result.total > 0),
  };
};
