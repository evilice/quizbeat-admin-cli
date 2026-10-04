import {
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { STATUS_LABELS, tagDisplayName } from '../composition-display.ts';
import type { Composition } from '../compositions-store.ts';

type CompositionsTableProps = {
  items: readonly Composition[];
  onEdit: (composition: Composition) => void;
  onDelete: (composition: Composition) => void;
};

export const CompositionsTable = ({
  items,
  onEdit,
  onDelete,
}: CompositionsTableProps) => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Название</TableCell>
          <TableCell>Автор</TableCell>
          <TableCell>Статус</TableCell>
          <TableCell>Теги</TableCell>
          <TableCell>Действия</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((composition) => (
          <CompositionRow
            key={composition.id}
            composition={composition}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </TableBody>
    </Table>
  );
};

type CompositionRowProps = {
  composition: Composition;
  onEdit: (composition: Composition) => void;
  onDelete: (composition: Composition) => void;
};

const CompositionRow = ({
  composition,
  onEdit,
  onDelete,
}: CompositionRowProps) => {
  return (
    <TableRow>
      <TableCell>{composition.title}</TableCell>
      <TableCell>{composition.author}</TableCell>
      <TableCell>{STATUS_LABELS[composition.status]}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {composition.tags.map((tag) => (
            <Chip key={tag.id} size="small" label={tagDisplayName(tag)} />
          ))}
        </Box>
      </TableCell>
      <TableCell>
        <Button
          size="small"
          onClick={() => {
            onEdit(composition);
          }}
        >
          Изменить
        </Button>
        <Button
          size="small"
          onClick={() => {
            onDelete(composition);
          }}
        >
          Удалить
        </Button>
      </TableCell>
    </TableRow>
  );
};
