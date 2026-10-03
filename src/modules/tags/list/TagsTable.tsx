import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { tagTranslationName } from '../tags-display.ts';
import type { Tag } from '../tags-store.ts';

type TagsTableProps = {
  items: readonly Tag[];
  actionPending: boolean;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
};

export const TagsTable = ({
  items,
  actionPending,
  onEdit,
  onDelete,
}: TagsTableProps) => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Код</TableCell>
          <TableCell>Название (ru)</TableCell>
          <TableCell>Название (en)</TableCell>
          <TableCell>Действия</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            actionPending={actionPending}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </TableBody>
    </Table>
  );
};

type TagRowProps = {
  tag: Tag;
  actionPending: boolean;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
};

const TagRow = ({ tag, actionPending, onEdit, onDelete }: TagRowProps) => {
  return (
    <TableRow>
      <TableCell>{tag.code}</TableCell>
      <TableCell>{tagTranslationName(tag, 'ru')}</TableCell>
      <TableCell>{tagTranslationName(tag, 'en')}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            disabled={actionPending}
            onClick={() => {
              onEdit(tag);
            }}
          >
            Изменить
          </Button>
          <Button
            disabled={actionPending}
            onClick={() => {
              onDelete(tag);
            }}
          >
            Удалить
          </Button>
        </Box>
      </TableCell>
    </TableRow>
  );
};
