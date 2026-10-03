import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
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
import { useNavigate } from 'react-router';
import { ApiError } from '../../shared/api/api-error.ts';
import {
  type Composition,
  type CompositionStatus,
  type ListCompositionsParams,
  type PaginatedCompositions,
} from './compositions-store.ts';
import type { Tag } from '../../modules/tags/tags-store.ts';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import type { CompositionLocationState } from './CompositionCardPage.tsx';
import { STATUS_LABELS, tagDisplayName } from './composition-display.ts';
import { CreateCompositionDialog } from './CreateCompositionDialog.tsx';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';

type StatusFilter = 'all' | CompositionStatus;

const EMPTY_LIST_MESSAGE = 'Ничего не найдено';

const TAGS_FILTER_LIMIT = 100;

const DELETE_CONFIRM_TEXT =
  'Композиция исчезнет из списка. Вернуть её из интерфейса нельзя — отдельного восстановления на сервере нет.';

export const CompositionsPage = observer(function CompositionsPage() {
  const { compositions, tags } = useRootStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<Tag[]>([]);
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);
  const [result, setResult] = useState<PaginatedCompositions | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Composition | null>(null);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void tags
      .list({ limit: TAGS_FILTER_LIMIT })
      .then((pageResult) => {
        if (!cancelled) {
          setTagOptions(pageResult.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTagOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tags]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setMessages([]);

    const params: ListCompositionsParams = { page };
    if (search !== '') {
      params.search = search;
    }
    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (selectedTagIds.length > 0) {
      params.tagIds = selectedTagIds;
    }

    void compositions
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
  }, [compositions, search, statusFilter, selectedTagIds, page, listVersion]);

  function reloadList() {
    setListVersion((current) => current + 1);
  }

  function openComposition(composition: Composition) {
    const state: CompositionLocationState = {
      title: composition.title,
      author: composition.author,
    };
    void navigate(`/compositions/${composition.id}`, { state });
  }

  async function handleConfirmDelete() {
    if (deleteTarget === null || actionPending) {
      return;
    }
    const targetId = deleteTarget.id;
    setActionPending(true);
    setMessages([]);
    try {
      await compositions.remove(targetId);
      setDeleteTarget(null);
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
        if (error.status === 404) {
          setDeleteTarget(null);
          setLoading(true);
          try {
            const params: ListCompositionsParams = { page };
            if (search !== '') {
              params.search = search;
            }
            if (statusFilter !== 'all') {
              params.status = statusFilter;
            }
            if (selectedTagIds.length > 0) {
              params.tagIds = selectedTagIds;
            }
            const pageResult = await compositions.list(params);
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

  const hasError = messages.length > 0;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const limit = result?.limit ?? 20;
  const currentPage = result?.page ?? page;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showEmpty =
    !loading && !hasError && result !== null && items.length === 0;
  const showTable = items.length > 0;

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
          label="Поиск по названию или автору"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="compositions-status-filter-label">Статус</InputLabel>
          <Select
            labelId="compositions-status-filter-label"
            label="Статус"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="DRAFT">{STATUS_LABELS.DRAFT}</MenuItem>
            <MenuItem value="PUBLISHED">{STATUS_LABELS.PUBLISHED}</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 240 }}>
          <InputLabel id="compositions-tags-filter-label">Теги</InputLabel>
          <Select
            labelId="compositions-tags-filter-label"
            label="Теги"
            multiple
            value={selectedTagIds}
            input={<OutlinedInput label="Теги" />}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTagIds(
                typeof value === 'string' ? value.split(',') : value,
              );
              setPage(1);
            }}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((id) => {
                  const tag = tagOptions.find((item) => item.id === id);
                  return (
                    <Chip
                      key={id}
                      size="small"
                      label={tag ? tagDisplayName(tag) : id}
                    />
                  );
                })}
              </Box>
            )}
          >
            {tagOptions.map((tag) => (
              <MenuItem key={tag.id} value={tag.id}>
                {tagDisplayName(tag)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          Создать
        </Button>
      </Box>

      <CreateCompositionDialog
        open={createOpen}
        tagOptions={tagOptions}
        onClose={() => {
          setCreateOpen(false);
        }}
        onCreated={() => {
          setCreateOpen(false);
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
        <DialogTitle>Удалить {deleteTarget?.title ?? ''}?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography component="p" sx={{ m: 0 }}>
              Автор: {deleteTarget?.author ?? ''}
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
              <TableCell>Название</TableCell>
              <TableCell>Автор</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Теги</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((composition) => (
              <TableRow key={composition.id}>
                <TableCell>{composition.title}</TableCell>
                <TableCell>{composition.author}</TableCell>
                <TableCell>{STATUS_LABELS[composition.status]}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {composition.tags.map((tag) => (
                      <Chip
                        key={tag.id}
                        size="small"
                        label={tagDisplayName(tag)}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => {
                      openComposition(composition);
                    }}
                  >
                    Изменить
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setDeleteTarget(composition);
                    }}
                  >
                    Удалить
                  </Button>
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
