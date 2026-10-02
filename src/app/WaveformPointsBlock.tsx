import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/api-error.ts';
import {
  AUDIO_CLIP_DURATIONS,
  type AudioClipDurationSec,
  type AudioClipPoint,
} from '../stores/audio-clips-store.ts';
import type { AudioClipDifficulty } from '../stores/compositions-store.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { AudioWaveform } from './AudioWaveform.tsx';
import { DIFFICULTY_LABELS, isPointInsideTrack } from './audio-display.ts';
import { ErrorMessages } from './ErrorMessages.tsx';

const DIFFICULTIES: readonly AudioClipDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

type DraftPoint = AudioClipPoint & { key: string };

export function WaveformPointsBlock({
  compositionId,
  originalAudioUrl,
  originalAudioDurationSec,
  onPointsCreated,
}: {
  compositionId: string;
  originalAudioUrl: string | null;
  originalAudioDurationSec: number | null;
  onPointsCreated: () => void;
}) {
  const { audioClips } = useRootStore();
  const [freshUrl, setFreshUrl] = useState<{
    source: string | null;
    url: string;
  } | null>(null);
  const [startInput, setStartInput] = useState('0');
  const [durationSec, setDurationSec] = useState<AudioClipDurationSec>(5);
  const [difficulty, setDifficulty] = useState<AudioClipDifficulty>('EASY');
  const [drafts, setDrafts] = useState<DraftPoint[]>([]);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const draftKey = useRef(0);
  const autoRefreshUsed = useRef(false);

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
          setFreshUrl({ source: originalAudioUrl, url: result.url });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError) {
          setMessages(error.messages);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioClips, compositionId, originalAudioDurationSec, originalAudioUrl]);

  const waveUrl =
    freshUrl !== null && freshUrl.source === originalAudioUrl
      ? freshUrl.url
      : originalAudioUrl;

  async function loadFreshUrl() {
    try {
      const result = await audioClips.getAudioUrl(compositionId);
      setFreshUrl({ source: originalAudioUrl, url: result.url });
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
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

  function handleWaveReady() {
    autoRefreshUsed.current = false;
  }

  function handlePick(relativeX: number) {
    if (originalAudioDurationSec === null) {
      return;
    }
    const start = Math.floor(relativeX * originalAudioDurationSec);
    setStartInput(String(Math.max(0, start)));
  }

  function addPoint() {
    if (originalAudioDurationSec === null) {
      return;
    }
    const startTimeSec = Number(startInput);
    if (!Number.isInteger(startTimeSec) || startTimeSec < 0) {
      setMessages(['Старт — целое число секунд, не меньше 0']);
      return;
    }
    if (
      !isPointInsideTrack(startTimeSec, durationSec, originalAudioDurationSec)
    ) {
      setMessages(['Точка выходит за длительность трека']);
      return;
    }
    setMessages([]);
    const key = `draft-${String(draftKey.current)}`;
    draftKey.current += 1;
    setDrafts((current) => [
      ...current,
      {
        key,
        startTimeSec,
        durationSec,
        difficulty,
      },
    ]);
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
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      data-testid="waveform-points-block"
      data-boundary-duration={
        originalAudioDurationSec === null
          ? ''
          : String(originalAudioDurationSec)
      }
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 720 }}
    >
      <Typography variant="h6" component="h2">
        Разметка отрезков
      </Typography>
      {originalAudioDurationSec === null ? (
        <Typography>Разметка доступна после загрузки трека</Typography>
      ) : (
        <>
          {waveUrl !== null ? (
            <>
              <AudioWaveform
                url={waveUrl}
                onPick={handlePick}
                onError={handleWaveError}
                onReady={handleWaveReady}
              />
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
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Старт, с"
              type="number"
              value={startInput}
              onChange={(event) => {
                setStartInput(event.target.value);
              }}
              slotProps={{ htmlInput: { step: 1, min: 0 } }}
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
            <Button variant="outlined" onClick={addPoint}>
              Добавить точку
            </Button>
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
