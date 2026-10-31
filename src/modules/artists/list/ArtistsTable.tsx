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
import type { Artist } from '../artists-store.ts';

type ArtistsTableProps = {
  items: readonly Artist[];
  actionPending: boolean;
  onEdit: (artist: Artist) => void;
  onDelete: (artist: Artist) => void;
};

export const ArtistsTable = ({
  items,
  actionPending,
  onEdit,
  onDelete,
}: ArtistsTableProps) => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Имя</TableCell>
          <TableCell align="right">Действия</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((artist) => (
          <ArtistRow
            key={artist.id}
            artist={artist}
            actionPending={actionPending}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </TableBody>
    </Table>
  );
};

type ArtistRowProps = {
  artist: Artist;
  actionPending: boolean;
  onEdit: (artist: Artist) => void;
  onDelete: (artist: Artist) => void;
};

const ArtistRow = ({
  artist,
  actionPending,
  onEdit,
  onDelete,
}: ArtistRowProps) => {
  return (
    <TableRow>
      <TableCell>{artist.name}</TableCell>
      <TableCell align="right">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <ActionIconButton
            label="Изменить"
            path={EDIT_ICON_PATH}
            disabled={actionPending}
            onClick={() => {
              onEdit(artist);
            }}
          />
          <ActionIconButton
            label="Удалить"
            path={DELETE_ICON_PATH}
            disabled={actionPending}
            onClick={() => {
              onDelete(artist);
            }}
          />
        </Box>
      </TableCell>
    </TableRow>
  );
};
