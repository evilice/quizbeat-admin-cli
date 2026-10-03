import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { ListTagsParams, PaginatedTags, Tag } from '../tags-store.ts';

type ListState = {
  key: string;
  result: PaginatedTags | null;
  messages: readonly string[];
};

const listMessagesFrom = (error: unknown): readonly string[] => {
  if (error instanceof ApiError) {
    return error.messages;
  }
  return [];
};

export const useTagsList = () => {
  const { tags } = useRootStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);
  const [listState, setListState] = useState<ListState | null>(null);
  const [actionMessages, setActionMessages] = useState<
    readonly string[] | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const requestKey = JSON.stringify([page, search, listVersion]);

  useEffect(() => {
    let cancelled = false;
    const params: ListTagsParams = { page, search };

    void tags
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
            messages: listMessagesFrom(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tags, search, page, listVersion, requestKey]);

  const loading = listState?.key !== requestKey || refreshing;
  const listMessages = listState?.key === requestKey ? listState.messages : [];
  const messages = actionMessages ?? listMessages;
  const hasError = messages.length > 0;
  const result = listState?.result ?? null;
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
    setSearch(value);
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
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditTarget(tag);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  const handleSaved = () => {
    closeForm();
    reloadList();
  };

  const openDelete = (tag: Tag) => {
    setDeleteTarget(tag);
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
      await tags.remove(targetId);
      setDeleteTarget(null);
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setActionMessages(error.messages);
        if (error.status === 404) {
          setDeleteTarget(null);
          setRefreshing(true);
          try {
            const pageResult = await tags.list({ page, search });
            setListState({
              key: requestKey,
              result: pageResult,
              messages: [],
            });
          } catch (listError) {
            if (listError instanceof ApiError) {
              setActionMessages(listError.messages);
            }
          } finally {
            setRefreshing(false);
          }
        }
      }
    } finally {
      setActionPending(false);
    }
  };

  return {
    search,
    onSearchChange,
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
    formOpen,
    editTarget,
    openCreate,
    openEdit,
    closeForm,
    handleSaved,
    deleteTarget,
    openDelete,
    closeDelete,
    confirmDelete,
  };
};
