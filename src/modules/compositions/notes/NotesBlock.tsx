import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import type { CompositionNote } from './notes-store.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import {
  ActionIconButton,
  ARROW_DOWN_ICON_PATH,
  ARROW_UP_ICON_PATH,
  DELETE_ICON_PATH,
  EDIT_ICON_PATH,
} from '../../../shared/ui/ActionIconButton.tsx';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { NoteFormDialog } from './NoteFormDialog.tsx';
import { noteText } from './note-text.ts';

export function NotesBlock({
  compositionId,
  initialNotes,
}: {
  compositionId: string;
  initialNotes: CompositionNote[];
}) {
  const { notes: notesStore } = useRootStore();
  const [notes, setNotes] = useState(initialNotes);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompositionNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompositionNote | null>(
    null,
  );

  function handleSaved(saved: CompositionNote) {
    const created = !notes.some((item) => item.id === saved.id);
    setNotes((current) => upsertNote(current, saved));
    setFormOpen(false);
    setEditTarget(null);
    if (created) {
      void reloadNotes();
    }
  }

  async function reloadNotes() {
    try {
      const listed = await notesStore.listNotes(compositionId);
      setNotes(listed);
    } catch (error) {
      setMessages(messagesFromError(error));
    }
  }

  function move(noteId: string, direction: -1 | 1) {
    if (busy || notes.length === 0) {
      return;
    }
    const ids = notes.map((note) => note.id);
    const index = ids.indexOf(noteId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) {
      return;
    }
    const next = [...ids];
    const fromId = next[index];
    const toId = next[target];
    if (fromId === undefined || toId === undefined) {
      return;
    }
    next[index] = toId;
    next[target] = fromId;
    void persistOrder(next);
  }

  async function persistOrder(nextIds: readonly string[]) {
    if (nextIds.length === 0) {
      return;
    }
    const previous = notes;
    setNotes(notesInOrder(previous, nextIds));
    setMessages([]);
    setBusy(true);
    try {
      const updated = await notesStore.reorderNotes(compositionId, nextIds);
      setNotes(updated);
    } catch (error) {
      setNotes(previous);
      setMessages(messagesFromError(error));
    } finally {
      setBusy(false);
    }
  }

  function openDelete(target: CompositionNote) {
    setMessages([]);
    setDeleteTarget(target);
  }

  function closeDelete() {
    setMessages([]);
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (deleteTarget === null) {
      return;
    }
    const noteId = deleteTarget.id;
    setBusy(true);
    setMessages([]);
    let removed = false;
    try {
      await notesStore.removeNote(compositionId, noteId);
      removed = true;
      setDeleteTarget(null);
    } catch (error) {
      setMessages(messagesFromError(error));
    }

    try {
      const listed = await notesStore.listNotes(compositionId);
      setNotes(listed);
    } catch (error) {
      if (removed) {
        setNotes((current) => current.filter((note) => note.id !== noteId));
      }
      setMessages(messagesFromError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      data-testid="notes-block"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography variant="h6" component="h2">
        А знали ли Вы?
      </Typography>
      <Box>
        <Button
          variant="outlined"
          disabled={busy}
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          Создать
        </Button>
      </Box>
      {notes.length === 0 ? (
        <Typography>Заметок нет</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Порядок</TableCell>
              <TableCell>Текст (ru)</TableCell>
              <TableCell>Текст (en)</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notes.map((note, index) => (
              <TableRow
                key={note.id}
                data-note-id={note.id}
                data-note-index={String(index)}
              >
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: 'fit-content',
                    }}
                  >
                    <ActionIconButton
                      label="Выше"
                      ariaLabel={`Выше ${note.id}`}
                      path={ARROW_UP_ICON_PATH}
                      disabled={busy || index === 0}
                      onClick={() => {
                        move(note.id, -1);
                      }}
                    />
                    <ActionIconButton
                      label="Ниже"
                      ariaLabel={`Ниже ${note.id}`}
                      path={ARROW_DOWN_ICON_PATH}
                      disabled={busy || index === notes.length - 1}
                      onClick={() => {
                        move(note.id, 1);
                      }}
                    />
                  </Box>
                </TableCell>
                <TableCell data-testid={`note-text-ru-${note.id}`}>
                  {noteText(note, 'ru')}
                </TableCell>
                <TableCell data-testid={`note-text-en-${note.id}`}>
                  {noteText(note, 'en')}
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 0.5,
                    }}
                  >
                    <ActionIconButton
                      label="Изменить"
                      ariaLabel={`Изменить заметку ${note.id}`}
                      path={EDIT_ICON_PATH}
                      disabled={busy}
                      onClick={() => {
                        setEditTarget(note);
                        setFormOpen(true);
                      }}
                    />
                    <ActionIconButton
                      label="Удалить"
                      ariaLabel={`Удалить заметку ${note.id}`}
                      path={DELETE_ICON_PATH}
                      disabled={busy}
                      onClick={() => {
                        openDelete(note);
                      }}
                    />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ErrorMessages messages={deleteTarget === null ? messages : []} />
      <NoteFormDialog
        key={formOpen ? (editTarget?.id ?? 'create') : 'closed'}
        open={formOpen}
        compositionId={compositionId}
        note={editTarget}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSaved={handleSaved}
      />
      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!busy) {
            closeDelete();
          }
        }}
      >
        <DialogTitle>Удалить заметку?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Заметка исчезнет безвозвратно. Восстановить её нельзя.
          </DialogContentText>
          {deleteTarget !== null ? (
            <>
              <Typography>{noteText(deleteTarget, 'ru')}</Typography>
              <Typography>{noteText(deleteTarget, 'en')}</Typography>
            </>
          ) : null}
          <ErrorMessages messages={deleteTarget === null ? [] : messages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} disabled={busy}>
            Отмена
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={busy}
            onClick={() => {
              void confirmDelete();
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function upsertNote(
  current: readonly CompositionNote[],
  saved: CompositionNote,
): CompositionNote[] {
  const index = current.findIndex((item) => item.id === saved.id);
  if (index < 0) {
    return [...current, saved];
  }
  return current.map((item) => (item.id === saved.id ? saved : item));
}

function notesInOrder(
  current: readonly CompositionNote[],
  ids: readonly string[],
): CompositionNote[] {
  const byId = new Map(current.map((note) => [note.id, note]));
  return ids.flatMap((id, index) => {
    const note = byId.get(id);
    if (note === undefined) {
      return [];
    }
    return [{ ...note, order: index }];
  });
}
