import { Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { ListPagination } from '../../shared/ui/ListPagination.tsx';
import { ListWithFilters } from '../../shared/ui/ListWithFilters.tsx';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { EMPTY_ARTISTS_MESSAGE } from './artists-display.ts';
import { ArtistFormDialog } from './form/ArtistFormDialog.tsx';
import { ArtistsFilters } from './list/ArtistsFilters.tsx';
import { ArtistsTable } from './list/ArtistsTable.tsx';
import { DeleteArtistDialog } from './list/DeleteArtistDialog.tsx';
import { useArtistsList } from './list/use-artists-list.ts';

export const ArtistsPage = observer(() => {
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
  } = useArtistsList();

  return (
    <ListWithFilters
      filters={
        <ArtistsFilters
          search={search}
          onSearchChange={onSearchChange}
          onCreate={openCreate}
        />
      }
    >
      <ArtistFormDialog
        key={formOpen ? (editTarget?.id ?? 'create') : 'closed'}
        open={formOpen}
        artist={editTarget}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      <DeleteArtistDialog
        artist={deleteTarget}
        pending={actionPending}
        messages={deleteMessages}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />

      <ErrorMessages messages={messages} />

      {showEmpty ? <Typography>{EMPTY_ARTISTS_MESSAGE}</Typography> : null}

      {showTable ? (
        <ArtistsTable
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
