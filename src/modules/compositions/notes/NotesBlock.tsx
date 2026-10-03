import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/api-error.ts';
import type { CompositionNote } from './notes-store.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
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
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
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
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setBusy(false);
    }
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
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    }

    try {
      const listed = await notesStore.listNotes(compositionId);
      setNotes(listed);
    } catch (error) {
      if (removed) {
        setNotes((current) => current.filter((note) => note.id !== noteId));
      }
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      data-testid="notes-block"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 720 }}
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {notes.map((note, index) => (
            <Box
              key={note.id}
              data-note-id={note.id}
              data-note-index={String(index)}
              sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography data-testid={`note-text-ru-${note.id}`}>
                  {noteText(note, 'ru')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  data-testid={`note-text-en-${note.id}`}
                >
                  {noteText(note, 'en')}
                </Typography>
              </Box>
              <Button
                size="small"
                disabled={busy}
                aria-label={`Изменить заметку ${note.id}`}
                onClick={() => {
                  setEditTarget(note);
                  setFormOpen(true);
                }}
              >
                Изменить
              </Button>
              <Button
                size="small"
                disabled={busy || index === 0}
                aria-label={`Выше ${note.id}`}
                onClick={() => {
                  move(note.id, -1);
                }}
              >
                Выше
              </Button>
              <Button
                size="small"
                disabled={busy || index === notes.length - 1}
                aria-label={`Ниже ${note.id}`}
                onClick={() => {
                  move(note.id, 1);
                }}
              >
                Ниже
              </Button>
              <Button
                size="small"
                color="warning"
                disabled={busy}
                aria-label={`Удалить заметку ${note.id}`}
                onClick={() => {
                  setDeleteTarget(note);
                }}
              >
                Удалить
              </Button>
            </Box>
          ))}
        </Box>
      )}
      <ErrorMessages messages={messages} />
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
            setDeleteTarget(null);
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
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteTarget(null);
            }}
            disabled={busy}
          >
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
