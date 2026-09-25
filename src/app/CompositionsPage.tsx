import {
  Box,
  Button,
  Chip,
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
import { ApiError } from '../api/api-error.ts';
import {
  type CompositionStatus,
  type ListCompositionsParams,
  type PaginatedCompositions,
} from '../stores/compositions-store.ts';
import {
  type Tag,
  type TagLocale,
} from '../stores/tags-store.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { ErrorMessages } from './ErrorMessages.tsx';

type StatusFilter = 'all' | CompositionStatus;

const STATUS_LABELS: Record<CompositionStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликована',
};

const EMPTY_LIST_MESSAGE = 'Ничего не найдено';

const TAGS_FILTER_LIMIT = 100;

export const CompositionsPage = observer(function CompositionsPage() {
  const { compositions, tags } = useRootStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<Tag[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedCompositions | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, [compositions, search, statusFilter, selectedTagIds, page]);

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
      </Box>

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

function tagDisplayName(tag: Tag): string {
  return translationName(tag, 'ru') || tag.code;
}

function translationName(tag: Tag, locale: TagLocale): string {
  return tag.translations.find((item) => item.locale === locale)?.name ?? '';
}
