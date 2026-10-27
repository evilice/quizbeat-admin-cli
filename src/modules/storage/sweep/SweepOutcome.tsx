import { Box, Typography } from '@mui/material';
import {
  failedSweepMessage,
  filesWord,
  formatBytes,
} from '../storage-display.ts';
import type { StorageSweepResult } from '../storage-store.ts';

type SweepOutcomeProps = {
  result: StorageSweepResult;
};

export const SweepOutcome = ({ result }: SweepOutcomeProps) => {
  return (
    <Box role="status">
      <Typography>
        Удалено: {result.total.count} {filesWord(result.total.count)}
      </Typography>
      <Typography>Освобождено: {formatBytes(result.total.bytes)}</Typography>
      <Typography>Ошибок: {result.failed}</Typography>
      {result.failed > 0 ? (
        <Typography color="warning.main">
          {failedSweepMessage(result.failedBytes)}
        </Typography>
      ) : null}
    </Box>
  );
};
