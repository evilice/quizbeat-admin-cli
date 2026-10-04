import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import type { CompositionNote, NoteTranslation } from './notes-store.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { noteText } from './note-text.ts';

type NoteFormDialogProps = {
  open: boolean;
  compositionId: string;
  note: CompositionNote | null;
  onClose: () => void;
  onSaved: (note: CompositionNote) => void;
};

export function NoteFormDialog({
  open,
  compositionId,
  note,
  onClose,
  onSaved,
}: NoteFormDialogProps) {
  const { notes } = useRootStore();
  const [textRu, setTextRu] = useState(
    note === null ? '' : noteText(note, 'ru'),
  );
  const [textEn, setTextEn] = useState(
    note === null ? '' : noteText(note, 'en'),
  );
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = note !== null;

  function resetForm() {
    setTextRu('');
    setTextEn('');
    setMessages([]);
  }

  function handleClose() {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedRu = textRu.trim();
    const trimmedEn = textEn.trim();

    if (trimmedRu === '') {
      setMessages(['Укажите текст (ru)']);
      return;
    }
    if (trimmedEn === '') {
      setMessages(['Укажите текст (en)']);
      return;
    }

    const translations: NoteTranslation[] = [
      { locale: 'ru', text: trimmedRu },
      { locale: 'en', text: trimmedEn },
    ];

    setSubmitting(true);
    setMessages([]);
    try {
      const saved =
        note === null
          ? await notes.createNote(compositionId, translations)
          : await notes.updateNote(compositionId, note.id, translations);
      resetForm();
      onSaved(saved);
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <DialogTitle>
          {isEdit ? 'Изменить заметку' : 'Создать заметку'}
        </DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
        >
          <TextField
            label="Текст (ru)"
            value={textRu}
            onChange={(event) => {
              setTextRu(event.target.value);
            }}
            autoComplete="off"
            fullWidth
            margin="dense"
            multiline
            minRows={2}
          />
          <TextField
            label="Текст (en)"
            value={textEn}
            onChange={(event) => {
              setTextEn(event.target.value);
            }}
            autoComplete="off"
            fullWidth
            multiline
            minRows={2}
          />
          <ErrorMessages messages={messages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
