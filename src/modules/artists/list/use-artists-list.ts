import { useState } from 'react';
import { ApiError, messagesFromError } from '../../../shared/api/api-error.ts';
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from '../../../shared/hooks/use-debounced-value.ts';
import {
  listPresentation,
  useListQuery,
} from '../../../shared/hooks/use-list-query.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import { artistInUseMessage } from '../artists-display.ts';
import type { Artist } from '../artists-store.ts';

const ARTISTS_PAGE_LIMIT = 20;

export const useArtistsList = () => {
  const { artists } = useRootStore();
  const [searchInput, setSearchInput] = useState('');
  const [actionMessages, setActionMessages] = useState<
    readonly string[] | null
  >(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Artist | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Artist | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const query = useListQuery({
    params: { search },
    fetchPage: ({ search: text }, page) =>
      artists.list({ page, search: text, limit: ARTISTS_PAGE_LIMIT }),
  });

  const deleting = deleteTarget !== null;
  const messages =
    deleting || actionMessages === null ? query.listMessages : actionMessages;
  const presentation = listPresentation({
    result: query.result,
    loading: query.loading,
    hasError: messages.length > 0,
  });

  const reloadList = () => {
    setActionMessages(null);
    query.reload();
  };

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    query.resetPage();
    setActionMessages(null);
  };

  const goToPreviousPage = () => {
    query.goToPreviousPage();
    setActionMessages(null);
  };

  const goToNextPage = () => {
    query.goToNextPage();
    setActionMessages(null);
  };

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (artist: Artist) => {
    setEditTarget(artist);
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

  const openDelete = (artist: Artist) => {
    setActionMessages(null);
    setDeleteTarget(artist);
  };

  const closeDelete = () => {
    if (actionPending) {
      return;
    }
    setActionMessages(null);
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
      await artists.remove(targetId);
      setDeleteTarget(null);
      reloadList();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Запись уже удалили: диалог закрываем и молча перечитываем страницу.
        // `reload` меняет поколение запроса, поэтому ответ старого GET
        // не вернёт удалённую строку.
        setDeleteTarget(null);
        reloadList();
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        const compositionCount = error.details?.compositionCount;
        setActionMessages(
          typeof compositionCount === 'number'
            ? [artistInUseMessage(compositionCount)]
            : messagesFromError(error),
        );
        return;
      }
      setActionMessages(messagesFromError(error));
    } finally {
      setActionPending(false);
    }
  };

  return {
    search: searchInput,
    onSearchChange,
    messages,
    deleteMessages: deleting ? (actionMessages ?? []) : [],
    ...presentation,
    items: query.items,
    actionPending,
    loading: query.loading,
    currentPage: query.currentPage,
    totalPages: query.totalPages,
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
