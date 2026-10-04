import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, messagesFromError } from '../../../shared/api/api-error.ts';
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from '../../../shared/hooks/use-debounced-value.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { CompositionLocationState } from '../card/use-composition-card.ts';
import type {
  Composition,
  CompositionStatus,
  ListCompositionsParams,
  PaginatedCompositions,
} from '../compositions-store.ts';
import { useTagOptions } from '../use-tag-options.ts';

export type StatusFilter = 'all' | CompositionStatus;

type ListState = {
  key: string;
  result: PaginatedCompositions | null;
  messages: readonly string[];
};

const buildParams = (
  search: string,
  statusFilter: StatusFilter,
  selectedTagIds: readonly string[],
  page: number,
): ListCompositionsParams => {
  const params: ListCompositionsParams = { page };
  if (search !== '') {
    params.search = search;
  }
  if (statusFilter !== 'all') {
    params.status = statusFilter;
  }
  if (selectedTagIds.length > 0) {
    params.tagIds = [...selectedTagIds];
  }
  return params;
};

export const useCompositionsList = () => {
  const { compositions } = useRootStore();
  const navigate = useNavigate();
  const { tagOptions, tagMessages } = useTagOptions();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);
  const [listState, setListState] = useState<ListState | null>(null);
  const [actionMessages, setActionMessages] = useState<
    readonly string[] | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Composition | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const requestKey = JSON.stringify([
    buildParams(search, statusFilter, selectedTagIds, page),
    listVersion,
  ]);
  const requestKeyRef = useRef(requestKey);

  useEffect(() => {
    requestKeyRef.current = requestKey;
    let cancelled = false;
    const params = buildParams(search, statusFilter, selectedTagIds, page);

    void compositions
      .list(params)
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
  }, [
    compositions,
    search,
    statusFilter,
    selectedTagIds,
    page,
    listVersion,
    requestKey,
  ]);

  const loading = listState?.key !== requestKey || refreshing;
  const listMessages = loading ? [] : (listState?.messages ?? []);
  const messages = actionMessages ?? listMessages;
  const result = listState?.result ?? null;
  const hasError = messages.length > 0;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const limit = result?.limit ?? 20;
  const currentPage = result?.page ?? page;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showEmpty =
    !loading && !hasError && result !== null && items.length === 0;
  const showTable = items.length > 0;
  const showPagination =
    showTable || (!hasError && result !== null && total > 0);

  const reloadList = () => {
    setActionMessages(null);
    setListVersion((current) => current + 1);
  };

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
    setActionMessages(null);
  };

  const onStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
    setActionMessages(null);
  };

  const onTagsFilterChange = (value: string[]) => {
    setSelectedTagIds(value);
    setPage(1);
    setActionMessages(null);
  };

  const goToPreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
    setActionMessages(null);
  };

  const goToNextPage = () => {
    setPage((current) => current + 1);
    setActionMessages(null);
  };

  const openCreate = () => {
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
  };

  const handleCreated = () => {
    setCreateOpen(false);
    reloadList();
  };

  const openComposition = (composition: Composition) => {
    const state: CompositionLocationState = {
      title: composition.title,
      author: composition.author,
    };
    void navigate(`/compositions/${composition.id}`, { state });
  };

  const openDelete = (composition: Composition) => {
    setDeleteTarget(composition);
  };

  const closeDelete = () => {
    if (actionPending) {
      return;
    }
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (deleteTarget === null || actionPending) {
      return;
    }
    const targetId = deleteTarget.id;
    setActionPending(true);
    setActionMessages([]);
    try {
      await compositions.remove(targetId);
      setDeleteTarget(null);
      reloadList();
    } catch (error) {
      setActionMessages(messagesFromError(error));
      if (error instanceof ApiError && error.status === 404) {
        setDeleteTarget(null);
        setRefreshing(true);
        try {
          const pageResult = await compositions.list(
            buildParams(search, statusFilter, selectedTagIds, page),
          );
          if (requestKeyRef.current === requestKey) {
            setListState({
              key: requestKey,
              result: pageResult,
              messages: [],
            });
          }
        } catch (listError) {
          setActionMessages(messagesFromError(listError));
        } finally {
          setRefreshing(false);
        }
      }
    } finally {
      setActionPending(false);
    }
  };

  return {
    search: searchInput,
    statusFilter,
    selectedTagIds,
    tagOptions,
    tagMessages,
    onSearchChange,
    onStatusFilterChange,
    onTagsFilterChange,
    messages,
    showEmpty,
    showTable,
    items,
    actionPending,
    loading,
    showPagination,
    currentPage,
    totalPages,
    goToPreviousPage,
    goToNextPage,
    createOpen,
    openCreate,
    closeCreate,
    handleCreated,
    openComposition,
    deleteTarget,
    openDelete,
    closeDelete,
    confirmDelete,
  };
};
