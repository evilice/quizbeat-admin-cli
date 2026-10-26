import {
  Box,
  Button,
  LinearProgress,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import type { ChangeEvent } from 'react';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { visuallyHiddenInputSx } from '../../../shared/ui/visually-hidden-input.ts';
import { useVideoTrim } from './use-video-trim.ts';

const HINT =
  'mp4, webm, ориентир размера — 500 МБ; тип и размер проверяет сервер; видео с iPhone (.mov) не поддерживается';

const UPLOAD_HINT = 'Идёт загрузка и обрезка — это может занять до пары минут';

export const VideoTrimEditor = ({
  compositionId,
  active = true,
  showHeading = true,
  onSaved,
  onBusyChange,
}: {
  compositionId: string;
  active?: boolean;
  showHeading?: boolean;
  onSaved: (compositionId: string, videoDurationSec: number) => void;
  onBusyChange?: (busy: boolean) => void;
}) => {
  const {
    videoRef,
    file,
    objectUrl,
    durationSec,
    start,
    end,
    busy,
    messages,
    blockReason,
    saveDisabled,
    playDisabled,
    boundsLocked,
    sliderValue,
    selectFile,
    setStart,
    setEnd,
    setSlider,
    setStartToCurrent,
    setEndToCurrent,
    playClip,
    onLoadedMetadata,
    onTimeUpdate,
    onPause,
    onEnded,
    onVideoError,
    submit,
  } = useVideoTrim({ compositionId, active, onSaved, onBusyChange });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    const next = list === null || list.length === 0 ? null : (list[0] ?? null);
    event.target.value = '';
    if (next !== null) {
      selectFile(next);
    }
  };

  return (
    <Box
      data-testid="video-trim-editor"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {showHeading ? (
        <Typography variant="h6" component="h2">
          Видео
        </Typography>
      ) : null}
      <Typography variant="body2">{HINT}</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          component="label"
          variant="outlined"
          disabled={busy}
          sx={{ position: 'relative' }}
        >
          Выбрать файл
          <Box
            component="input"
            type="file"
            accept=".mp4,.webm,video/mp4,video/webm"
            aria-label="Видео-файл"
            disabled={busy}
            onChange={handleFileChange}
            sx={visuallyHiddenInputSx}
          />
        </Button>
        {file !== null ? (
          <Typography variant="body2">{file.name}</Typography>
        ) : null}
      </Box>
      {objectUrl !== null ? (
        <Box
          sx={{
            width: '100%',
            maxHeight: 360,
            bgcolor: 'common.black',
            '& video': { display: 'block', width: '100%', maxHeight: 360 },
          }}
        >
          <video
            key={objectUrl}
            ref={videoRef}
            controls
            src={objectUrl}
            aria-label="Предпросмотр видео"
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            onPause={onPause}
            onEnded={onEnded}
            onError={onVideoError}
          />
        </Box>
      ) : null}
      {sliderValue !== null && durationSec !== null ? (
        <Slider
          value={sliderValue}
          min={0}
          max={durationSec}
          step={0.01}
          disableSwap
          disabled={boundsLocked}
          getAriaLabel={(index) =>
            index === 0 ? 'Начало отрезка' : 'Конец отрезка'
          }
          onChange={(_event, value) => {
            setSlider(value);
          }}
        />
      ) : null}
      {durationSec !== null ? (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <TextField
            label="Начало, с"
            type="number"
            value={start}
            disabled={boundsLocked}
            onChange={(event) => {
              setStart(event.target.value);
            }}
            slotProps={{ htmlInput: { step: 0.01, min: 0 } }}
          />
          <TextField
            label="Конец, с"
            type="number"
            value={end}
            disabled={boundsLocked}
            onChange={(event) => {
              setEnd(event.target.value);
            }}
            slotProps={{ htmlInput: { step: 0.01, min: 0 } }}
          />
        </Box>
      ) : null}
      {blockReason !== null ? (
        <Typography color="error">{blockReason}</Typography>
      ) : null}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          disabled={durationSec === null || boundsLocked}
          onClick={setStartToCurrent}
        >
          Начало = текущая позиция
        </Button>
        <Button
          variant="outlined"
          disabled={durationSec === null || boundsLocked}
          onClick={setEndToCurrent}
        >
          Конец = текущая позиция
        </Button>
        <Button variant="outlined" disabled={playDisabled} onClick={playClip}>
          Проиграть отрезок
        </Button>
        <Button
          variant="contained"
          disabled={saveDisabled}
          onClick={() => {
            void submit();
          }}
        >
          Сохранить
        </Button>
      </Box>
      {busy ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <LinearProgress aria-label={UPLOAD_HINT} />
          <Typography variant="body2">{UPLOAD_HINT}</Typography>
        </Box>
      ) : null}
      <ErrorMessages messages={messages} />
    </Box>
  );
};
