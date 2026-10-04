import { useState } from 'react';
import { useNavigate } from 'react-router';
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
import type { CompositionLocationState } from '../card/use-composition-card.ts';
import type {
  Composition,
  CompositionStatus,
  ListCompositionsParams,
} from '../compositions-store.ts';
import { useTagOptions } from '../use-tag-options.ts';

export type StatusFilter = 'all' | CompositionStatus;

type ListFilters = {
  search: string;
  statusFilter: StatusFilter;
  selectedTagIds: readonly string[];
};

const buildParams = (
  { search, statusFilter, selectedTagIds }: ListFilters,
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
  const [actionMessages, setActionMessages] = useState<
    readonly string[] | null
  >(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Composition | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const query = useListQuery({
    params: { search, statusFilter, selectedTagIds },
    fetchPage: (filters, page) => compositions.list(buildParams(filters, page)),
  });

  const messages = actionMessages ?? query.listMessages;
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

  const onStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    query.resetPage();
    setActionMessages(null);
  };

  const onTagsFilterChange = (value: string[]) => {
    setSelectedTagIds(value);
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
        const refreshMessages = await query.refreshCurrentPage();
        if (refreshMessages !== null) {
          setActionMessages(refreshMessages);
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
    ...presentation,
    items: query.items,
    actionPending,
    loading: query.loading,
    currentPage: query.currentPage,
    totalPages: query.totalPages,
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
