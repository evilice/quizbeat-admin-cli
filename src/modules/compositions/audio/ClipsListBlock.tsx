import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  SvgIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import type { AudioClip } from './audio-clips-store.ts';
import { useAttemptThrottle } from '../../../shared/hooks/use-attempt-throttle.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import {
  CLIP_STATUS_LABELS,
  DIFFICULTY_LABELS,
  hasUnfinishedClip,
} from './audio-display.ts';
import {
  ActionIconButton,
  DELETE_ICON_PATH,
  PLAY_ICON_PATH,
  STOP_ICON_PATH,
} from '../../../shared/ui/ActionIconButton.tsx';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';

const DONE_ICON_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';
const REGENERATE_ICON_PATH =
  'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z';

export const CLIPS_POLL_INTERVAL_MS = 2000;
const URL_REFRESH_INTERVAL_MS = 60_000;

export function ClipsListBlock({
  compositionId,
  initialClips,
  reloadToken,
  active = true,
}: {
  compositionId: string;
  initialClips: AudioClip[];
  reloadToken: number;
  /** Блок на скрытой вкладке остаётся смонтированным, но не должен играть. */
  active?: boolean;
}) {
  const { audioClips } = useRootStore();
  const [clips, setClips] = useState(initialClips);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [haltedToken, setHaltedToken] = useState<number | null>(null);
  const pollingEnabled = haltedToken !== reloadToken;
  const [deleteTarget, setDeleteTarget] = useState<AudioClip | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    playingIdRef.current = playingId;
  }, [playingId]);

  useEffect(() => {
    if (active || playingIdRef.current === null) {
      return;
    }
    const audio = document.getElementById(`clip-audio-${playingIdRef.current}`);
    if (audio instanceof HTMLAudioElement) {
      audio.pause();
    }
  }, [active]);

  function openDelete(target: AudioClip) {
    setMessages([]);
    setDeleteTarget(target);
  }

  function closeDelete() {
    setMessages([]);
    setDeleteTarget(null);
  }

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

  if (
    playingId !== null &&
    !clips.some((clip) => clip.id === playingId && clip.status === 'DONE')
  ) {
    setPlayingId(null);
  }

  function setPlayback(clipId: string | null) {
    playingIdRef.current = clipId;
    setPlayingId(clipId);
  }

  function toggleClipPlayback(clipId: string) {
    const audio = document.getElementById(`clip-audio-${clipId}`);
    if (!(audio instanceof HTMLAudioElement)) {
      return;
    }

    if (playingIdRef.current === clipId) {
      audio.pause();
      audio.currentTime = 0;
      setPlayback(null);
      return;
    }

    for (const item of clips) {
      if (item.id === clipId || item.status !== 'DONE') {
        continue;
      }
      const other = document.getElementById(`clip-audio-${item.id}`);
      if (other instanceof HTMLAudioElement) {
        other.pause();
        other.currentTime = 0;
      }
    }

    audio.currentTime = 0;
    setPlayback(clipId);
    const started = audio.play();
    void Promise.resolve(started)
      .then(() => {
        if (playingIdRef.current !== clipId) {
          audio.pause();
        }
      })
      .catch(() => {
        if (playingIdRef.current === clipId) {
          setPlayback(null);
        }
      });
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
              <TableCell>Длительность</TableCell>
              <TableCell>Сложность</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clips.map((clip) => (
              <TableRow key={clip.id}>
                <TableCell>{clip.durationSec} с</TableCell>
                <TableCell>{DIFFICULTY_LABELS[clip.difficulty]}</TableCell>
                <TableCell>
                  {clip.status === 'DONE' ? (
                    <DoneStatusIcon />
                  ) : (
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
                  )}
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 0.5,
                      position: 'relative',
                    }}
                  >
                    {clip.status === 'DONE' && clip.fileUrl !== undefined ? (
                      <>
                        <audio
                          id={`clip-audio-${clip.id}`}
                          src={clip.fileUrl}
                          preload="none"
                          aria-label={`Прослушать ${clip.id}`}
                          onEnded={() => {
                            if (playingIdRef.current === clip.id) {
                              setPlayback(null);
                            }
                          }}
                          onPause={() => {
                            if (playingIdRef.current === clip.id) {
                              setPlayback(null);
                            }
                          }}
                          onError={() => {
                            if (playingIdRef.current === clip.id) {
                              setPlayback(null);
                            }
                            handleClipExpired(clip.id);
                          }}
                          style={{
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            opacity: 0,
                            pointerEvents: 'none',
                          }}
                        />
                        <ActionIconButton
                          label={
                            playingId === clip.id ? 'Остановить' : 'Проиграть'
                          }
                          path={
                            playingId === clip.id
                              ? STOP_ICON_PATH
                              : PLAY_ICON_PATH
                          }
                          disabled={actionPending}
                          onClick={() => {
                            toggleClipPlayback(clip.id);
                          }}
                        />
                      </>
                    ) : null}
                    {clip.status === 'DONE' || clip.status === 'FAILED' ? (
                      <ActionIconButton
                        label="Перегенерировать"
                        path={REGENERATE_ICON_PATH}
                        disabled={actionPending}
                        onClick={() => {
                          void regenerate(clip);
                        }}
                      />
                    ) : null}
                    <ActionIconButton
                      label="Удалить"
                      path={DELETE_ICON_PATH}
                      disabled={actionPending}
                      onClick={() => {
                        openDelete(clip);
                      }}
                    />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ErrorMessages messages={deleteTarget === null ? messages : []} />
      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!actionPending) {
            closeDelete();
          }
        }}
      >
        <DialogTitle>Удалить отрезок?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Отрезок исчезнет безвозвратно. Восстановить его нельзя.
          </DialogContentText>
          <ErrorMessages messages={deleteTarget === null ? [] : messages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} disabled={actionPending}>
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

function DoneStatusIcon() {
  return (
    <Tooltip title={CLIP_STATUS_LABELS.DONE}>
      <Box
        component="span"
        role="img"
        aria-label={CLIP_STATUS_LABELS.DONE}
        sx={{ display: 'inline-flex', color: 'success.main' }}
      >
        <SvgIcon fontSize="small">
          <path d={DONE_ICON_PATH} />
        </SvgIcon>
      </Box>
    </Tooltip>
  );
}
