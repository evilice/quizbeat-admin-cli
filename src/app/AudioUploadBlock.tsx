import { Box, Button, Typography } from '@mui/material';
import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError } from '../api/api-error.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { ErrorMessages } from './ErrorMessages.tsx';

const HINT =
  'Можно загрузить mp3, wav или flac. Ориентир размера — 200 МБ. Тип и размер проверяет сервер.';

export function AudioUploadBlock({
  compositionId,
  originalAudioUrl,
  originalAudioDurationSec,
  onUploaded,
}: {
  compositionId: string;
  originalAudioUrl: string | null;
  originalAudioDurationSec: number | null;
  onUploaded: (originalAudioDurationSec: number) => void;
}) {
  const { audioClips } = useRootStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [uploading, setUploading] = useState(false);
  const trackLoaded =
    originalAudioUrl !== null || originalAudioDurationSec !== null;

  async function upload() {
    if (file === null) {
      return;
    }
    setUploading(true);
    setMessages([]);
    try {
      const result = await audioClips.uploadAudio(compositionId, file);
      onUploaded(result.originalAudioDurationSec);
      setFile(null);
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    const next = list === null || list.length === 0 ? null : (list[0] ?? null);
    setFile(next);
  }

  return (
    <Box
      data-testid="audio-upload-block"
      data-track-loaded={trackLoaded ? 'true' : 'false'}
      data-duration={
        originalAudioDurationSec === null
          ? ''
          : String(originalAudioDurationSec)
      }
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 720 }}
    >
      <Typography variant="h6" component="h2">
        Исходный трек
      </Typography>
      <Typography variant="body2">{HINT}</Typography>
      {trackLoaded ? (
        <Typography>
          {originalAudioDurationSec === null
            ? 'Трек загружен.'
            : `Трек принят. Длительность: ${String(originalAudioDurationSec)} с.`}
        </Typography>
      ) : (
        <Typography>Трек не загружен</Typography>
      )}
      {trackLoaded ? (
        <Typography variant="body2">
          Новый файл заменит текущий оригинал. Уже нарезанные отрезки останутся.
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          component="label"
          variant="outlined"
          disabled={uploading}
          sx={{ position: 'relative' }}
        >
          Выбрать файл
          <Box
            component="input"
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
            aria-label="Файл трека"
            onChange={handleFileChange}
            sx={{
              clip: 'rect(0 0 0 0)',
              clipPath: 'inset(50%)',
              height: 1,
              overflow: 'hidden',
              position: 'absolute',
              bottom: 0,
              left: 0,
              whiteSpace: 'nowrap',
              width: 1,
            }}
          />
        </Button>
        <Button
          variant="contained"
          disabled={file === null || uploading}
          onClick={() => {
            void upload();
          }}
        >
          Загрузить
        </Button>
        {file !== null ? (
          <Typography variant="body2">{file.name}</Typography>
        ) : null}
      </Box>
      <ErrorMessages messages={messages} />
    </Box>
  );
}
