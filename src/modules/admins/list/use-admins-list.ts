import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { StaffRole } from '../../session/parse-access-token.ts';
import {
  type Admin,
  type ListAdminsParams,
  type PaginatedAdmins,
} from '../admins-store.ts';

export type RoleFilter = 'all' | StaffRole;
export type ActivityFilter = 'all' | 'active' | 'inactive';

export const useAdminsList = () => {
  const { admins, session } = useRootStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedAdmins | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Admin | null>(null);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [passwordResetConfirmed, setPasswordResetConfirmed] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setMessages([]);

    const params: ListAdminsParams = { page };
    if (search !== '') {
      params.search = search;
    }
    if (roleFilter !== 'all') {
      params.role = roleFilter;
    }
    if (activityFilter === 'active') {
      params.isActive = true;
    } else if (activityFilter === 'inactive') {
      params.isActive = false;
    }

    void admins
      .list(params)
      .then((pageResult) => {
        if (cancelled) {
          return;
        }
        setResult(pageResult);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setResult(null);
        if (error instanceof ApiError) {
          setMessages(error.messages);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [admins, search, roleFilter, activityFilter, page, listVersion]);

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

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const onRoleFilterChange = (value: RoleFilter) => {
    setRoleFilter(value);
    setPage(1);
  };

  const onActivityFilterChange = (value: ActivityFilter) => {
    setActivityFilter(value);
    setPage(1);
  };

  const goToPreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const goToNextPage = () => {
    setPage((current) => current + 1);
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
    setPasswordResetConfirmed(false);
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

  const changeRole = async (admin: Admin, nextRole: StaffRole) => {
    if (nextRole === admin.role || actionPending) {
      return;
    }
    setActionPending(true);
    setMessages([]);
    try {
      await admins.update(admin.id, { role: nextRole });
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setActionPending(false);
    }
  };

  const activate = async (admin: Admin) => {
    if (actionPending) {
      return;
    }
    setActionPending(true);
    setMessages([]);
    try {
      await admins.update(admin.id, { isActive: true });
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setActionPending(false);
    }
  };

  const confirmDeactivate = async () => {
    if (deactivateTarget === null || actionPending) {
      return;
    }
    const targetId = deactivateTarget.id;
    setActionPending(true);
    setMessages([]);
    try {
      await admins.deactivate(targetId);
      if (targetId === session.id) {
        session.forgetRefresh();
      }
      setDeactivateTarget(null);
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setActionPending(false);
    }
  };

  const handlePasswordReset = (adminId: string) => {
    if (adminId === session.id) {
      session.forgetRefresh();
    }
    setResetTarget(null);
    setPasswordResetConfirmed(true);
    setMessages([]);
    reloadList();
  };

  return {
    search,
    roleFilter,
    activityFilter,
    onSearchChange,
    onRoleFilterChange,
    onActivityFilterChange,
    messages,
    passwordResetConfirmed,
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
