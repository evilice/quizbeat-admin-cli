import { useEffect, useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { StaffRole } from '../../session/parse-access-token.ts';
import {
  PASSWORD_RESET_NOTICE,
  SELF_ROLE_CHANGED_NOTICE,
} from '../admin-display.ts';
import {
  type Admin,
  type ListAdminsParams,
  type PaginatedAdmins,
} from '../admins-store.ts';
import { useDebouncedValue } from './use-debounced-value.ts';

export type RoleFilter = 'all' | StaffRole;
export type ActivityFilter = 'all' | 'active' | 'inactive';

const SEARCH_DEBOUNCE_MS = 300;

type ListState = {
  key: string;
  result: PaginatedAdmins | null;
  messages: readonly string[];
};

const buildParams = (
  search: string,
  roleFilter: RoleFilter,
  activityFilter: ActivityFilter,
  page: number,
): ListAdminsParams => {
  const params: ListAdminsParams = { page };
  if (search !== '') {
    params.search = search;
  }
  if (roleFilter !== 'all') {
    params.role = roleFilter;
  }
  if (activityFilter !== 'all') {
    params.isActive = activityFilter === 'active';
  }
  return params;
};

export const useAdminsList = () => {
  const { admins, session } = useRootStore();
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);
  const [listState, setListState] = useState<ListState | null>(null);
  const [actionMessages, setActionMessages] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Admin | null>(null);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const requestKey = JSON.stringify([
    buildParams(search, roleFilter, activityFilter, page),
    listVersion,
  ]);

  useEffect(() => {
    let cancelled = false;
    const params = buildParams(search, roleFilter, activityFilter, page);

    admins
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
  }, [admins, search, roleFilter, activityFilter, page, requestKey]);

  const loading = listState?.key !== requestKey;
  const listMessages = loading ? [] : (listState?.messages ?? []);
  const messages = [...listMessages, ...actionMessages];
  const result = listState?.result ?? null;
  const hasError = messages.length > 0;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const limit = result?.limit ?? 20;
  const currentPage = result?.page ?? page;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showEmpty =
    !loading && !hasError && result !== null && items.length === 0;
  // Таблица остаётся при ошибке действия (409): result не сбрасываем.
  // При 403 списка result = null, items пусты — таблицы нет.
  const showTable = items.length > 0;
  const showPagination =
    showTable || (!hasError && result !== null && total > 0);

  const reloadList = () => {
    setListVersion((current) => current + 1);
  };

  const resetFeedback = () => {
    setActionMessages([]);
    setNotice(null);
  };

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
    resetFeedback();
  };

  const onRoleFilterChange = (value: RoleFilter) => {
    setRoleFilter(value);
    setPage(1);
    resetFeedback();
  };

  const onActivityFilterChange = (value: ActivityFilter) => {
    setActivityFilter(value);
    setPage(1);
    resetFeedback();
  };

  const goToPreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
    resetFeedback();
  };

  const goToNextPage = () => {
    setPage((current) => current + 1);
    resetFeedback();
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

  const openReset = (admin: Admin) => {
    setNotice(null);
    setResetTarget(admin);
  };

  const closeReset = () => {
    setResetTarget(null);
  };

  const openDeactivate = (admin: Admin) => {
    setDeactivateTarget(admin);
  };

  const closeDeactivate = () => {
    if (actionPending) {
      return;
    }
    setDeactivateTarget(null);
  };

  const runAction = async (action: () => Promise<void>) => {
    if (actionPending) {
      return;
    }
    setActionPending(true);
    resetFeedback();
    try {
      await action();
      reloadList();
    } catch (error) {
      setActionMessages(messagesFromError(error));
    } finally {
      setActionPending(false);
    }
  };

  const changeRole = async (admin: Admin, nextRole: StaffRole) => {
    if (nextRole === admin.role) {
      return;
    }
    await runAction(async () => {
      await admins.update(admin.id, { role: nextRole });
      if (admin.id === session.id) {
        setNotice(SELF_ROLE_CHANGED_NOTICE);
      }
    });
  };

  const activate = async (admin: Admin) => {
    await runAction(async () => {
      await admins.update(admin.id, { isActive: true });
    });
  };

  const confirmDeactivate = async () => {
    if (deactivateTarget === null) {
      return;
    }
    const targetId = deactivateTarget.id;
    await runAction(async () => {
      await admins.deactivate(targetId);
      if (targetId === session.id) {
        session.forgetRefresh();
      }
      setDeactivateTarget(null);
    });
  };

  const handlePasswordReset = (adminId: string) => {
    if (adminId === session.id) {
      session.forgetRefresh();
    }
    setResetTarget(null);
    setActionMessages([]);
    setNotice(PASSWORD_RESET_NOTICE);
    reloadList();
  };

  return {
    search: searchInput,
    roleFilter,
    activityFilter,
    onSearchChange,
    onRoleFilterChange,
    onActivityFilterChange,
    messages,
    notice,
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
    resetTarget,
    openReset,
    closeReset,
    handlePasswordReset,
    deactivateTarget,
    openDeactivate,
    closeDeactivate,
    confirmDeactivate,
    changeRole,
    activate,
  };
};
