import { useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import {
  listPresentation,
  useListQuery,
} from '../../../shared/hooks/use-list-query.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { StaffRole } from '../../session/parse-access-token.ts';
import {
  PASSWORD_RESET_NOTICE,
  SELF_ROLE_CHANGED_NOTICE,
} from '../admin-display.ts';
import type { Admin, ListAdminsParams } from '../admins-store.ts';
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from '../../../shared/hooks/use-debounced-value.ts';

export type RoleFilter = 'all' | StaffRole;
export type ActivityFilter = 'all' | 'active' | 'inactive';

type ListFilters = {
  search: string;
  roleFilter: RoleFilter;
  activityFilter: ActivityFilter;
};

const buildParams = (
  { search, roleFilter, activityFilter }: ListFilters,
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
  const [activityFilter, setActivityFilter] =
    useState<ActivityFilter>('active');
  const [actionMessages, setActionMessages] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Admin | null>(null);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const query = useListQuery({
    params: { search, roleFilter, activityFilter },
    fetchPage: (filters, page) => admins.list(buildParams(filters, page)),
  });

  const messages = [...query.listMessages, ...actionMessages];
  const presentation = listPresentation({
    result: query.result,
    loading: query.loading,
    hasError: messages.length > 0,
  });

  const reloadList = query.reload;

  const resetFeedback = () => {
    setActionMessages([]);
    setNotice(null);
  };

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    query.resetPage();
    resetFeedback();
  };

  const onRoleFilterChange = (value: RoleFilter) => {
    setRoleFilter(value);
    query.resetPage();
    resetFeedback();
  };

  const onActivityFilterChange = (value: ActivityFilter) => {
    setActivityFilter(value);
    query.resetPage();
    resetFeedback();
  };

  const goToPreviousPage = () => {
    query.goToPreviousPage();
    resetFeedback();
  };

  const goToNextPage = () => {
    query.goToNextPage();
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
    resetFeedback();
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
