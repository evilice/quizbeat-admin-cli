import {
  Box,
  Button,
  CircularProgress,
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
import { useEffect, useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import type { AudioClip } from './audio-clips-store.ts';
import { useAttemptThrottle } from '../../../shared/hooks/use-attempt-throttle.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import {
  CLIP_STATUS_LABELS,
  DIFFICULTY_LABELS,
  hasUnfinishedClip,
} from './audio-display.ts';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';

export const CLIPS_POLL_INTERVAL_MS = 2000;
const URL_REFRESH_INTERVAL_MS = 60_000;

export function ClipsListBlock({
  compositionId,
  initialClips,
  reloadToken,
}: {
  compositionId: string;
  initialClips: AudioClip[];
  reloadToken: number;
}) {
  const { audioClips } = useRootStore();
  const [clips, setClips] = useState(initialClips);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [haltedToken, setHaltedToken] = useState<number | null>(null);
  const pollingEnabled = haltedToken !== reloadToken;
  const [deleteTarget, setDeleteTarget] = useState<AudioClip | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const mayRefreshUrl = useAttemptThrottle(URL_REFRESH_INTERVAL_MS);

  useEffect(() => {
    if (reloadToken === 0) {
      return;
    }

    let cancelled = false;
    void audioClips
      .listClips(compositionId)
      .then((next) => {
        if (!cancelled) {
          setClips(next);
          setMessages([]);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessages(messagesFromError(error));
          setHaltedToken(reloadToken);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioClips, compositionId, reloadToken]);

  useEffect(() => {
    if (!pollingEnabled || !hasUnfinishedClip(clips)) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void audioClips
        .listClips(compositionId)
        .then((next) => {
          if (!cancelled) {
            setClips(next);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setMessages(messagesFromError(error));
            setHaltedToken(reloadToken);
          }
        });
    }, CLIPS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [audioClips, clips, compositionId, pollingEnabled, reloadToken]);

  async function confirmDelete() {
    if (deleteTarget === null) {
      return;
    }
    const clipId = deleteTarget.id;
    setActionPending(true);
    setMessages([]);
    try {
      await audioClips.removeClip(compositionId, clipId);
    } catch (error) {
      setMessages(messagesFromError(error));
      setActionPending(false);
      return;
    }

    setClips((current) => current.filter((item) => item.id !== clipId));
    setDeleteTarget(null);
    setActionPending(false);

    try {
      const next = await audioClips.listClips(compositionId);
      setClips(next);
    } catch (error) {
      setMessages(messagesFromError(error));
    }
  }

  function handleClipExpired(clipId: string) {
    if (!mayRefreshUrl(clipId)) {
      return;
    }
    void audioClips
      .listClips(compositionId)
      .then((next) => {
        setClips(next);
      })
      .catch((error: unknown) => {
        setMessages(messagesFromError(error));
      });
  }

  async function regenerate(clip: AudioClip) {
    setMessages([]);
    setActionPending(true);
    try {
      const updated = await audioClips.regenerateClip(compositionId, clip.id);
      setHaltedToken(null);
      setClips((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <Box
      data-testid="clips-list-block"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography variant="h6" component="h2">
        Отрезки
      </Typography>
      {clips.length === 0 ? (
        <Typography>Отрезков нет</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Старт</TableCell>
              <TableCell>Длительность</TableCell>
              <TableCell>Сложность</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Прослушивание</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clips.map((clip) => (
              <TableRow key={clip.id}>
                <TableCell>{clip.startTimeSec} с</TableCell>
                <TableCell>{clip.durationSec} с</TableCell>
                <TableCell>{DIFFICULTY_LABELS[clip.difficulty]}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {clip.status === 'PENDING' ||
                    clip.status === 'PROCESSING' ? (
                      <CircularProgress
                        size={16}
                        aria-label={CLIP_STATUS_LABELS[clip.status]}
                      />
                    ) : null}
                    {CLIP_STATUS_LABELS[clip.status]}
                  </Box>
                </TableCell>
                <TableCell>
                  <ClipPlayback clip={clip} onExpired={handleClipExpired} />
                </TableCell>
                <TableCell>
                  {clip.status === 'DONE' || clip.status === 'FAILED' ? (
                    <Button
                      size="small"
                      disabled={actionPending}
                      onClick={() => {
                        void regenerate(clip);
                      }}
                    >
                      Перегенерировать
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    color="warning"
                    disabled={actionPending}
                    aria-label={`Удалить отрезок ${clip.id}`}
                    onClick={() => {
                      setDeleteTarget(clip);
                    }}
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ErrorMessages messages={messages} />
      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!actionPending) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogTitle>Удалить отрезок?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Отрезок исчезнет безвозвратно. Восстановить его нельзя.
          </DialogContentText>
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
            disabled={actionPending}
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

function ClipPlayback({
  clip,
  onExpired,
}: {
  clip: AudioClip;
  onExpired: (clipId: string) => void;
}) {
  if (clip.status !== 'DONE' || clip.fileUrl === undefined) {
    return null;
  }

  return (
    <audio
      controls
      src={clip.fileUrl}
      aria-label={`Прослушать ${clip.id}`}
      onError={() => {
        onExpired(clip.id);
      }}
    />
  );
}
