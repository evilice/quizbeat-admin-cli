import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SvgIcon,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import {
  AUDIO_CLIP_DURATIONS,
  type AudioClipDifficulty,
  type AudioClipDurationSec,
  type AudioClipPoint,
} from './audio-clips-store.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import { AudioWaveform, type AudioWaveformHandle } from './AudioWaveform.tsx';
import { DIFFICULTY_LABELS, isPointInsideTrack } from './audio-display.ts';
import {
  ActionIconButton,
  PLAY_ICON_PATH,
} from '../../../shared/ui/ActionIconButton.tsx';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';

const DIFFICULTIES: readonly AudioClipDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

const TRIPLE_POINT_DURATIONS: readonly AudioClipDurationSec[] = [1, 3, 8];

const PAUSE_ICON_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

const ADD_POINT_ICON_PATH = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z';

const ADD_THREE_POINTS_ICON_PATH =
  'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z';

function parseStartSec(startInput: string): number | null {
  const startTimeSec = Number(startInput);
  if (!Number.isFinite(startTimeSec) || startTimeSec < 0) {
    return null;
  }
  return startTimeSec;
}

function clipPlaybackRange(
  startInput: string,
  durationSec: number,
  trackDurationSec: number | null,
): { startSec: number; endSec: number } | null {
  if (trackDurationSec === null || trackDurationSec <= 0) {
    return null;
  }
  const startTimeSec = parseStartSec(startInput);
  if (startTimeSec === null || startTimeSec >= trackDurationSec) {
    return null;
  }
  return {
    startSec: startTimeSec,
    endSec: Math.min(startTimeSec + durationSec, trackDurationSec),
  };
}

type DraftPoint = AudioClipPoint & { key: string };

export function WaveformPointsBlock({
  compositionId,
  originalAudioUrl,
  originalAudioDurationSec,
  audioVersion,
  onPointsCreated,
}: {
  compositionId: string;
  originalAudioUrl: string | null;
  originalAudioDurationSec: number | null;
  /** Растёт при каждой загрузке трека: новая дорожка при прежних длительности и ссылке. */
  audioVersion: number;
  onPointsCreated: () => void;
}) {
  const { audioClips } = useRootStore();
  const [freshUrl, setFreshUrl] = useState<{
    source: string | null;
    version: number;
    url: string;
  } | null>(null);
  const [startInput, setStartInput] = useState('0');
  const [durationSec, setDurationSec] = useState<AudioClipDurationSec>(5);
  const [difficulty, setDifficulty] = useState<AudioClipDifficulty>('EASY');
  const [drafts, setDrafts] = useState<DraftPoint[]>([]);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [waveReady, setWaveReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const draftKey = useRef(0);
  const autoRefreshUsed = useRef(false);
  const waveformRef = useRef<AudioWaveformHandle>(null);

  useEffect(() => {
    autoRefreshUsed.current = false;
  }, [originalAudioUrl]);

  useEffect(() => {
    if (originalAudioUrl !== null || originalAudioDurationSec === null) {
      return;
    }

    let cancelled = false;
    void audioClips
      .getAudioUrl(compositionId)
      .then((result) => {
        if (!cancelled) {
          setFreshUrl({
            source: originalAudioUrl,
            version: audioVersion,
            url: result.url,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessages(messagesFromError(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    audioClips,
    audioVersion,
    compositionId,
    originalAudioDurationSec,
    originalAudioUrl,
  ]);

  const waveUrl =
    freshUrl !== null &&
    freshUrl.source === originalAudioUrl &&
    freshUrl.version === audioVersion
      ? freshUrl.url
      : originalAudioUrl;

  async function loadFreshUrl() {
    try {
      const result = await audioClips.getAudioUrl(compositionId);
      setFreshUrl({
        source: originalAudioUrl,
        version: audioVersion,
        url: result.url,
      });
    } catch (error) {
      setMessages(messagesFromError(error));
    }
  }

  function refreshUrl() {
    autoRefreshUsed.current = true;
    setMessages([]);
    return loadFreshUrl();
  }

  function handleWaveError() {
    if (autoRefreshUsed.current) {
      setMessages(['Не удалось открыть ссылку на трек']);
      return;
    }
    autoRefreshUsed.current = true;
    void loadFreshUrl();
  }

  function handleWaveLoadStart() {
    setWaveReady(false);
    setPlaying(false);
  }

  function handleWaveReady() {
    autoRefreshUsed.current = false;
    setWaveReady(true);
  }

  function handlePlayingChange(next: boolean) {
    setPlaying(next);
  }

  function handleTogglePlayback() {
    const player = waveformRef.current;
    if (player === null) {
      return;
    }
    if (playing) {
      player.pause();
      return;
    }
    if (originalAudioDurationSec === null) {
      return;
    }
    const startTimeSec = parseStartSec(startInput);
    if (startTimeSec === null) {
      setMessages(['Старт — число секунд, не меньше 0']);
      return;
    }
    if (startTimeSec >= originalAudioDurationSec) {
      setMessages(['Точка выходит за длительность трека']);
      return;
    }
    setMessages([]);
    void player.playFrom(startTimeSec).catch(() => {
      setPlaying(false);
      setMessages(['Не удалось начать воспроизведение']);
    });
  }

  function handlePick(relativeX: number) {
    if (originalAudioDurationSec === null) {
      return;
    }
    const start =
      Math.round(Math.max(0, relativeX) * originalAudioDurationSec * 100) / 100;
    setStartInput(String(start));
  }

  function appendDrafts(durations: readonly AudioClipDurationSec[]) {
    if (originalAudioDurationSec === null) {
      return;
    }
    const startTimeSec = parseStartSec(startInput);
    if (startTimeSec === null) {
      setMessages(['Старт — число секунд, не меньше 0']);
      return;
    }
    if (
      durations.some(
        (item) =>
          !isPointInsideTrack(startTimeSec, item, originalAudioDurationSec),
      )
    ) {
      setMessages(['Точка выходит за длительность трека']);
      return;
    }
    setMessages([]);
    const next = durations.map((item) => {
      const key = `draft-${String(draftKey.current)}`;
      draftKey.current += 1;
      return {
        key,
        startTimeSec,
        durationSec: item,
        difficulty,
      };
    });
    setDrafts((current) => [...current, ...next]);
  }

  function addPoint() {
    appendDrafts([durationSec]);
  }

  function addThreePoints() {
    appendDrafts(TRIPLE_POINT_DURATIONS);
  }

  async function submitPoints() {
    if (originalAudioDurationSec === null || drafts.length === 0) {
      return;
    }
    const outOfRange = drafts.some(
      (point) =>
        !isPointInsideTrack(
          point.startTimeSec,
          point.durationSec,
          originalAudioDurationSec,
        ),
    );
    if (outOfRange) {
      setMessages(['Точка выходит за длительность трека']);
      return;
    }

    setSubmitting(true);
    setMessages([]);
    try {
      await audioClips.createClips(
        compositionId,
        drafts.map((point) => ({
          startTimeSec: point.startTimeSec,
          durationSec: point.durationSec,
          difficulty: point.difficulty,
        })),
      );
      setDrafts([]);
      onPointsCreated();
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setSubmitting(false);
    }
  }

  const clipRange = clipPlaybackRange(
    startInput,
    durationSec,
    originalAudioDurationSec,
  );
  const clipEndSec = clipRange?.endSec ?? null;

  return (
    <Box
      data-testid="waveform-points-block"
      data-boundary-duration={
        originalAudioDurationSec === null
          ? ''
          : String(originalAudioDurationSec)
      }
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="h6" component="h2">
          Разметка отрезков
        </Typography>
        <Tooltip title={playing ? 'Пауза' : 'Проиграть с точки'}>
          <Box component="span" sx={{ display: 'inline-flex' }}>
            <IconButton
              aria-label={playing ? 'Пауза' : 'Проиграть с точки'}
              disabled={waveUrl === null || !waveReady}
              onClick={handleTogglePlayback}
              sx={{
                border: '2px solid',
                borderColor: 'primary.main',
                color: 'primary.main',
                '&.Mui-disabled': {
                  borderColor: 'action.disabled',
                },
              }}
            >
              <SvgIcon>
                <path d={playing ? PAUSE_ICON_PATH : PLAY_ICON_PATH} />
              </SvgIcon>
            </IconButton>
          </Box>
        </Tooltip>
      </Box>
      {originalAudioDurationSec === null ? (
        <Typography>Разметка доступна после загрузки трека</Typography>
      ) : (
        <>
          {waveUrl !== null ? (
            <>
              <Box sx={{ position: 'relative', width: '100%' }}>
                <AudioWaveform
                  ref={waveformRef}
                  url={waveUrl}
                  endSec={clipEndSec}
                  onPick={handlePick}
                  onError={handleWaveError}
                  onReady={handleWaveReady}
                  onLoadStart={handleWaveLoadStart}
                  onPlayingChange={handlePlayingChange}
                />
                {clipRange !== null ? (
                  <Box
                    data-testid="clip-range"
                    data-start-sec={String(clipRange.startSec)}
                    data-end-sec={String(clipRange.endSec)}
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: `${(clipRange.startSec / originalAudioDurationSec) * 100}%`,
                      width: `${((clipRange.endSec - clipRange.startSec) / originalAudioDurationSec) * 100}%`,
                      height: 80,
                      bgcolor: '#1565c0',
                      opacity: 0.45,
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
                {clipEndSec !== null && originalAudioDurationSec > 0 ? (
                  <Box
                    data-testid="clip-end-marker"
                    data-end-sec={String(clipEndSec)}
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: `${(clipEndSec / originalAudioDurationSec) * 100}%`,
                      height: 80,
                      width: 2,
                      bgcolor: '#c62828',
                      pointerEvents: 'none',
                      transform: 'translateX(-1px)',
                    }}
                  />
                ) : null}
              </Box>
              <Button
                variant="text"
                onClick={() => {
                  void refreshUrl();
                }}
              >
                Обновить ссылку
              </Button>
            </>
          ) : (
            <Typography>Ссылка на волну обновляется</Typography>
          )}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <TextField
              label="Старт, с"
              type="number"
              value={startInput}
              onChange={(event) => {
                setStartInput(event.target.value);
              }}
              slotProps={{ htmlInput: { step: 'any', min: 0 } }}
            />
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel id="clip-duration-label">Длительность</InputLabel>
              <Select
                labelId="clip-duration-label"
                label="Длительность"
                value={durationSec}
                onChange={(event) => {
                  setDurationSec(
                    Number(event.target.value) as AudioClipDurationSec,
                  );
                }}
              >
                {AUDIO_CLIP_DURATIONS.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item} с
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel id="clip-difficulty-label">Сложность</InputLabel>
              <Select
                labelId="clip-difficulty-label"
                label="Сложность"
                value={difficulty}
                onChange={(event) => {
                  setDifficulty(event.target.value as AudioClipDifficulty);
                }}
              >
                {DIFFICULTIES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {DIFFICULTY_LABELS[item]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ActionIconButton
                label="Добавить точку"
                path={ADD_POINT_ICON_PATH}
                onClick={addPoint}
              />
              <ActionIconButton
                label="Добавить 3 точки"
                path={ADD_THREE_POINTS_ICON_PATH}
                onClick={addThreePoints}
              />
            </Box>
          </Box>
          {drafts.length === 0 ? (
            <Typography variant="body2">Точек в черновике нет</Typography>
          ) : (
            drafts.map((point) => (
              <Box
                key={point.key}
                sx={{ display: 'flex', gap: 2, alignItems: 'center' }}
              >
                <Typography>
                  {point.startTimeSec} с, {point.durationSec} с,{' '}
                  {DIFFICULTY_LABELS[point.difficulty]}
                </Typography>
                <IconButton
                  aria-label={`Убрать точку ${point.key}`}
                  onClick={() => {
                    setDrafts((current) =>
                      current.filter((item) => item.key !== point.key),
                    );
                  }}
                >
                  ×
                </IconButton>
              </Box>
            ))
          )}
          <Button
            variant="contained"
            disabled={drafts.length === 0 || submitting}
            onClick={() => {
              void submitPoints();
            }}
          >
            Отправить точки
          </Button>
        </>
      )}
      <ErrorMessages messages={messages} />
    </Box>
  );
}
