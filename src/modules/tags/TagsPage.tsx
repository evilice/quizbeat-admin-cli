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
  TextField,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/api-error.ts';
import {
  type ListTagsParams,
  type PaginatedTags,
  type Tag,
  type TagLocale,
} from './tags-store.ts';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { TagFormDialog } from './form/TagFormDialog.tsx';

const EMPTY_LIST_MESSAGE = 'Ничего не найдено';

const DELETE_CONFIRM_TEXT =
  'Тег удаляется безвозвратно. Композиции, на которых он был, теряют с ним связь и сами не удаляются. Вернуть тег нельзя.';

export const TagsPage = observer(function TagsPage() {
  const { tags } = useRootStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedTags | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setMessages([]);

    const params: ListTagsParams = { page, search };

    void tags
      .list(params)
      .then((pageResult) => {
        if (cancelled) {
          return;
        }
        setResult(pageResult);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setResult(null);
        if (error instanceof ApiError) {
          setMessages(error.messages);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tags, search, page, listVersion]);

  const hasError = messages.length > 0;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const limit = result?.limit ?? 20;
  const currentPage = result?.page ?? page;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showEmpty =
    !loading && !hasError && result !== null && items.length === 0;
  const showTable = items.length > 0;

  function reloadList() {
    setListVersion((current) => current + 1);
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(tag: Tag) {
    setEditTarget(tag);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  async function handleConfirmDelete() {
    if (deleteTarget === null || actionPending) {
      return;
    }
    const targetId = deleteTarget.id;
    setActionPending(true);
    setMessages([]);
    try {
      await tags.remove(targetId);
      setDeleteTarget(null);
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
        if (error.status === 404) {
          setDeleteTarget(null);
          setLoading(true);
          try {
            const pageResult = await tags.list({ page, search });
            setResult(pageResult);
          } catch (listError) {
            if (listError instanceof ApiError) {
              setMessages(listError.messages);
            }
          } finally {
            setLoading(false);
          }
        }
      }
    } finally {
      setActionPending(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'flex-start',
        }}
      >
        <TextField
          label="Поиск по названию"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Button variant="contained" onClick={openCreate}>
          Создать
        </Button>
      </Box>

      <TagFormDialog
        key={formOpen ? (editTarget?.id ?? 'create') : 'closed'}
        open={formOpen}
        tag={editTarget}
        onClose={closeForm}
        onSaved={() => {
          closeForm();
          reloadList();
        }}
      />

      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!actionPending) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogTitle>Удалить {deleteTarget?.code ?? ''}?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography component="p" sx={{ m: 0 }}>
              Название (ru): {translationName(deleteTarget, 'ru')}
            </Typography>
            <Typography component="p" sx={{ m: 0 }}>
              Название (en): {translationName(deleteTarget, 'en')}
            </Typography>
            <Typography component="p" sx={{ mt: 1, mb: 0 }}>
              {DELETE_CONFIRM_TEXT}
            </Typography>
          </DialogContentText>
          <ErrorMessages messages={messages} />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteTarget(null);
            }}
            disabled={actionPending}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              void handleConfirmDelete();
            }}
            disabled={actionPending}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <ErrorMessages messages={messages} />

      {showEmpty ? <Typography>{EMPTY_LIST_MESSAGE}</Typography> : null}

      {showTable ? (
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
              <TableRow key={tag.id}>
                <TableCell>{tag.code}</TableCell>
                <TableCell>{translationName(tag, 'ru')}</TableCell>
                <TableCell>{translationName(tag, 'en')}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Button
                      disabled={actionPending}
                      onClick={() => {
                        openEdit(tag);
                      }}
                    >
                      Изменить
                    </Button>
                    <Button
                      disabled={actionPending}
                      onClick={() => {
                        setDeleteTarget(tag);
                      }}
                    >
                      Удалить
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {showTable || (!hasError && result !== null && total > 0) ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            disabled={currentPage <= 1 || loading}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
          >
            Предыдущая страница
          </Button>
          <Typography>
            Страница {currentPage} из {totalPages}
          </Typography>
          <Button
            disabled={currentPage >= totalPages || loading}
            onClick={() => {
              setPage((current) => current + 1);
            }}
          >
            Следующая страница
          </Button>
        </Box>
      ) : null}
    </Box>
  );
});

function translationName(tag: Tag | null, locale: TagLocale): string {
  if (tag === null) {
    return '';
  }
  return tag.translations.find((item) => item.locale === locale)?.name ?? '';
}
