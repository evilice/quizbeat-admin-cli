import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useLastValue } from '../../../shared/hooks/use-last-value.ts';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import {
  DELETE_TAG_CONFIRM_TEXT,
  tagTranslationName,
} from '../tags-display.ts';
import type { Tag } from '../tags-store.ts';

type DeleteTagDialogProps = {
  tag: Tag | null;
  pending: boolean;
  messages: readonly string[];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export const DeleteTagDialog = ({
  tag,
  pending,
  messages,
  onClose,
  onConfirm,
}: DeleteTagDialogProps) => {
  const shownTag = useLastValue(tag);

  return (
    <Dialog open={tag !== null} onClose={onClose}>
      <DialogTitle>Удалить {shownTag?.code ?? ''}?</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography component="p" sx={{ m: 0 }}>
            Название (ru): {tagTranslationName(shownTag, 'ru')}
          </Typography>
          <Typography component="p" sx={{ m: 0 }}>
            Название (en): {tagTranslationName(shownTag, 'en')}
          </Typography>
          <Typography component="p" sx={{ mt: 1, mb: 0 }}>
            {DELETE_TAG_CONFIRM_TEXT}
          </Typography>
        </DialogContentText>
        <ErrorMessages messages={messages} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Отмена
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => {
            void onConfirm();
          }}
          disabled={pending}
        >
          Удалить
        </Button>
      </DialogActions>
    </Dialog>
  );
};
