import { Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { ListPagination } from '../../shared/ui/ListPagination.tsx';
import { ListWithFilters } from '../../shared/ui/ListWithFilters.tsx';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { EMPTY_COMPOSITIONS_MESSAGE } from './composition-display.ts';
import { CreateCompositionDialog } from './create/CreateCompositionDialog.tsx';
import { CompositionsFilters } from './list/CompositionsFilters.tsx';
import { CompositionsTable } from './list/CompositionsTable.tsx';
import { DeleteCompositionDialog } from './list/DeleteCompositionDialog.tsx';
import { useCompositionsList } from './list/use-compositions-list.ts';

export const CompositionsPage = observer(() => {
  const {
    search,
    statusFilter,
    selectedTagIds,
    tagOptions,
    tagMessages,
    onSearchChange,
    onStatusFilterChange,
    onTagsFilterChange,
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
    createOpen,
    openCreate,
    closeCreate,
    handleCreated,
    openComposition,
    deleteTarget,
    openDelete,
    closeDelete,
    confirmDelete,
  } = useCompositionsList();

  return (
    <ListWithFilters
      filters={
        <CompositionsFilters
          search={search}
          statusFilter={statusFilter}
          selectedTagIds={selectedTagIds}
          tagOptions={tagOptions}
          onSearchChange={onSearchChange}
          onStatusFilterChange={onStatusFilterChange}
          onTagsFilterChange={onTagsFilterChange}
          onCreate={openCreate}
        />
      }
    >
      <CreateCompositionDialog
        open={createOpen}
        tagOptions={tagOptions}
        onClose={closeCreate}
        onCreated={handleCreated}
      />

      <DeleteCompositionDialog
        composition={deleteTarget}
        pending={actionPending}
        messages={deleteMessages}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />

      <ErrorMessages messages={tagMessages} />
      <ErrorMessages messages={messages} />

      {showEmpty ? <Typography>{EMPTY_COMPOSITIONS_MESSAGE}</Typography> : null}

      {showTable ? (
        <CompositionsTable
          items={items}
          onEdit={openComposition}
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
