import { Box, Button, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { SweepConfirmDialog } from './sweep/SweepConfirmDialog.tsx';
import { SweepOutcome } from './sweep/SweepOutcome.tsx';
import { SweepPreviewTable } from './sweep/SweepPreviewTable.tsx';
import {
  STORAGE_DENIED_MESSAGE,
  STORAGE_NOTHING_TO_DELETE_MESSAGE,
  STORAGE_PENDING_MESSAGE,
} from './storage-display.ts';
import { useStorageSweep } from './use-storage-sweep.ts';

export const StoragePage = observer(() => {
  const {
    allowed,
    pending,
    preview,
    outcome,
    pageMessages,
    dialogMessages,
    confirmOpen,
    canDelete,
    deleteLabel,
    confirmCount,
    confirmBytes,
    check,
    openConfirm,
    closeConfirm,
    confirmSweep,
  } = useStorageSweep();

  if (!allowed) {
    return <Typography>{STORAGE_DENIED_MESSAGE}</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography component="h2" variant="h5">
        Хранилище
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={() => {
            void check();
          }}
          disabled={pending}
        >
          Проверить
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={openConfirm}
          disabled={!canDelete}
        >
          {deleteLabel}
        </Button>
      </Box>
      {pending && !confirmOpen ? (
        <Typography role="status">{STORAGE_PENDING_MESSAGE}</Typography>
      ) : null}
      <ErrorMessages messages={pageMessages} />
      {preview !== null ? <SweepPreviewTable result={preview} /> : null}
      {preview !== null && preview.total.count === 0 ? (
        <Typography role="status">
          {STORAGE_NOTHING_TO_DELETE_MESSAGE}
        </Typography>
      ) : null}
      {outcome !== null ? <SweepOutcome result={outcome} /> : null}
      <SweepConfirmDialog
        open={confirmOpen}
        count={confirmCount}
        bytes={confirmBytes}
        pending={pending}
        messages={dialogMessages}
        onClose={closeConfirm}
        onConfirm={confirmSweep}
      />
    </Box>
  );
});
