import { Box, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { EMPTY_ADMINS_MESSAGE } from './admin-display.ts';
import { CreateAdminDialog } from './create/CreateAdminDialog.tsx';
import { AdminsFilters } from './list/AdminsFilters.tsx';
import { AdminsPagination } from '../../shared/ui/ListPagination.tsx';
import { AdminsTable } from './list/AdminsTable.tsx';
import { DeactivateAdminDialog } from './list/DeactivateAdminDialog.tsx';
import { useAdminsList } from './list/use-admins-list.ts';
import { ResetPasswordDialog } from './reset-password/ResetPasswordDialog.tsx';

export const AdminsPage = observer(() => {
  const {
    search,
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
  } = useAdminsList();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <AdminsFilters
        search={search}
        roleFilter={roleFilter}
        activityFilter={activityFilter}
        onSearchChange={onSearchChange}
        onRoleFilterChange={onRoleFilterChange}
        onActivityFilterChange={onActivityFilterChange}
        onCreate={openCreate}
      />

      <CreateAdminDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={handleCreated}
      />

      <ResetPasswordDialog
        admin={resetTarget}
        onClose={closeReset}
        onReset={handlePasswordReset}
      />

      <DeactivateAdminDialog
        admin={deactivateTarget}
        pending={actionPending}
        messages={messages}
        onClose={closeDeactivate}
        onConfirm={confirmDeactivate}
      />

      <ErrorMessages messages={messages} />

      {notice !== null ? (
        <Typography role="status" color="success.main">
          {notice}
        </Typography>
      ) : null}

      {showEmpty ? <Typography>{EMPTY_ADMINS_MESSAGE}</Typography> : null}

      {showTable ? (
        <AdminsTable
          items={items}
          actionPending={actionPending}
          onRoleChange={changeRole}
          onResetPassword={openReset}
          onDeactivate={openDeactivate}
          onActivate={activate}
        />
      ) : null}

      {showPagination ? (
        <AdminsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          loading={loading}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
        />
      ) : null}
    </Box>
  );
});
