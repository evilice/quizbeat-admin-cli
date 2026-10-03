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
import { ApiError } from '../../shared/api/api-error.ts';
import { type Tag, type TagLocale, type TagTranslation } from './tags-store.ts';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';

type TagFormDialogProps = {
  open: boolean;
  tag: Tag | null;
  onClose: () => void;
  onSaved: () => void;
};

export function TagFormDialog({
  open,
  tag,
  onClose,
  onSaved,
}: TagFormDialogProps) {
  const { tags } = useRootStore();
  const [code, setCode] = useState(tag?.code ?? '');
  const [nameRu, setNameRu] = useState(
    tag !== null ? translationName(tag, 'ru') : '',
  );
  const [nameEn, setNameEn] = useState(
    tag !== null ? translationName(tag, 'en') : '',
  );
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = tag !== null;

  function resetForm() {
    setCode('');
    setNameRu('');
    setNameEn('');
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

    if (code === '') {
      setMessages(['Укажите код']);
      return;
    }
    if (nameRu === '') {
      setMessages(['Укажите название (ru)']);
      return;
    }
    if (nameEn === '') {
      setMessages(['Укажите название (en)']);
      return;
    }

    const translations: TagTranslation[] = [
      { locale: 'ru', name: nameRu },
      { locale: 'en', name: nameEn },
    ];

    setSubmitting(true);
    setMessages([]);
    try {
      if (tag === null) {
        await tags.create({ code, translations });
      } else {
        await tags.update(tag.id, { code, translations });
      }
      resetForm();
      onSaved();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <DialogTitle>{isEdit ? 'Изменить тег' : 'Создать тег'}</DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
        >
          <TextField
            label="Код"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            autoComplete="off"
            fullWidth
            margin="dense"
          />
          <TextField
            label="Название (ru)"
            value={nameRu}
            onChange={(event) => {
              setNameRu(event.target.value);
            }}
            autoComplete="off"
            fullWidth
          />
          <TextField
            label="Название (en)"
            value={nameEn}
            onChange={(event) => {
              setNameEn(event.target.value);
            }}
            autoComplete="off"
            fullWidth
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

function translationName(tag: Tag, locale: TagLocale): string {
  return tag.translations.find((item) => item.locale === locale)?.name ?? '';
}
