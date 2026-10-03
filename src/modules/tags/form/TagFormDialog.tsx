import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import type { Tag } from '../tags-store.ts';
import { useTagForm } from './use-tag-form.ts';

type TagFormDialogProps = {
  open: boolean;
  tag: Tag | null;
  onClose: () => void;
  onSaved: () => void;
};

export const TagFormDialog = ({
  open,
  tag,
  onClose,
  onSaved,
}: TagFormDialogProps) => {
  const {
    code,
    setCode,
    nameRu,
    setNameRu,
    nameEn,
    setNameEn,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  } = useTagForm(tag, onClose, onSaved);

  const isEdit = tag !== null;

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
};
