import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { formatBytes, prefixLabel } from '../storage-display.ts';
import type { StorageSweepResult } from '../storage-store.ts';

type SweepPreviewTableProps = {
  result: StorageSweepResult;
};

export const SweepPreviewTable = ({ result }: SweepPreviewTableProps) => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Префикс</TableCell>
          <TableCell>Файлы</TableCell>
          <TableCell>Объём</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {result.byPrefix.map((row) => (
          <TableRow key={row.prefix}>
            <TableCell>{prefixLabel(row.prefix)}</TableCell>
            <TableCell>{row.count}</TableCell>
            <TableCell>{formatBytes(row.bytes)}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell>Всего</TableCell>
          <TableCell>{result.total.count}</TableCell>
          <TableCell>{formatBytes(result.total.bytes)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};
