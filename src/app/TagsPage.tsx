import {
  Box,
  Button,
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
  type ListTagsParams,
  type PaginatedTags,
  type Tag,
  type TagLocale,
} from '../stores/tags-store.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { ErrorMessages } from './ErrorMessages.tsx';

const EMPTY_LIST_MESSAGE = 'Ничего не найдено';

export const TagsPage = observer(function TagsPage() {
  const { tags } = useRootStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedTags | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, [tags, search, page]);

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
      <TextField
        label="Поиск по названию"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />

      <ErrorMessages messages={messages} />

      {showEmpty ? <Typography>{EMPTY_LIST_MESSAGE}</Typography> : null}

      {showTable ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Код</TableCell>
              <TableCell>Название (ru)</TableCell>
              <TableCell>Название (en)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell>{tag.code}</TableCell>
                <TableCell>{translationName(tag, 'ru')}</TableCell>
                <TableCell>{translationName(tag, 'en')}</TableCell>
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

function translationName(tag: Tag, locale: TagLocale): string {
  return tag.translations.find((item) => item.locale === locale)?.name ?? '';
}
