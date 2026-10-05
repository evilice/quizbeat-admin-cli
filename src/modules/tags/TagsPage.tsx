import { Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { ListPagination } from '../../shared/ui/ListPagination.tsx';
import { ListWithFilters } from '../../shared/ui/ListWithFilters.tsx';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { TagFormDialog } from './form/TagFormDialog.tsx';
import { DeleteTagDialog } from './list/DeleteTagDialog.tsx';
import { TagsFilters } from './list/TagsFilters.tsx';
import { TagsTable } from './list/TagsTable.tsx';
import { useTagsList } from './list/use-tags-list.ts';
import { EMPTY_TAGS_MESSAGE } from './tags-display.ts';

export const TagsPage = observer(() => {
  const {
    search,
    onSearchChange,
    messages,
    deleteMessages,
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
  } = useTagsList();

  return (
    <ListWithFilters
      filters={
        <TagsFilters
          search={search}
          onSearchChange={onSearchChange}
          onCreate={openCreate}
        />
      }
    >
      <TagFormDialog
        key={formOpen ? (editTarget?.id ?? 'create') : 'closed'}
        open={formOpen}
        tag={editTarget}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      <DeleteTagDialog
        tag={deleteTarget}
        pending={actionPending}
        messages={deleteMessages}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />

      <ErrorMessages messages={messages} />

      {showEmpty ? <Typography>{EMPTY_TAGS_MESSAGE}</Typography> : null}

      {showTable ? (
        <TagsTable
          items={items}
          actionPending={actionPending}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      ) : null}

      {showPagination ? (
        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          loading={loading}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
        />
      ) : null}
    </ListWithFilters>
  );
});
