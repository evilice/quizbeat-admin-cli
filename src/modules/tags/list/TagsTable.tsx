import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ActionIconButton,
  DELETE_ICON_PATH,
  EDIT_ICON_PATH,
} from '../../../shared/ui/ActionIconButton.tsx';
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
          <TableCell align="right">Действия</TableCell>
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
      <TableCell align="right">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <ActionIconButton
            label="Изменить"
            path={EDIT_ICON_PATH}
            disabled={actionPending}
            onClick={() => {
              onEdit(tag);
            }}
          />
          <ActionIconButton
            label="Удалить"
            path={DELETE_ICON_PATH}
            disabled={actionPending}
            onClick={() => {
              onDelete(tag);
            }}
          />
        </Box>
      </TableCell>
    </TableRow>
  );
};
