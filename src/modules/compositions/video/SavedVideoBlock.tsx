import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { useSavedVideo } from './use-saved-video.ts';
import { VideoTrimEditor } from './VideoTrimEditor.tsx';

const IRREVERSIBLE =
  'Исходный файл не хранится: вернуть прежнее видео или изменить его границы будет нельзя';

const FETCHING_URL = 'Получаем ссылку';
const PLAYBACK_FAILED = 'Не удалось воспроизвести видео';

export const SavedVideoBlock = ({
  compositionId,
  videoUrl,
  videoDurationSec,
  videoVersion,
  active,
  onVideoSaved,
  onVideoRemoved,
  onVideoUrl,
}: {
  compositionId: string;
  videoUrl: string | null;
  videoDurationSec: number | null;
  videoVersion: number;
  active: boolean;
  onVideoSaved: (compositionId: string, videoDurationSec: number) => void;
  onVideoRemoved: (compositionId: string) => void;
  onVideoUrl: (compositionId: string, url: string) => void;
}) => {
  const {
    videoRef,
    hasVideo,
    replacing,
    replaceOpen,
    deleteOpen,
    busy,
    actionsLocked,
    setUploading,
    deleteMessages,
    urlMessages,
    playbackFailed,
    openReplace,
    closeReplace,
    continueReplace,
    cancelReplace,
    openDelete,
    closeDelete,
    confirmDelete,
    retryUrl,
    handleSaved,
    handlePlaybackError,
  } = useSavedVideo({
    compositionId,
    videoUrl,
    videoDurationSec,
    videoVersion,
    active,
    onVideoSaved,
    onVideoRemoved,
    onVideoUrl,
  });

  const editor = (
    <VideoTrimEditor
      compositionId={compositionId}
      active={active}
      showHeading={!hasVideo}
      onSaved={handleSaved}
      onBusyChange={setUploading}
    />
  );

  return (
    <Box
      data-testid="saved-video-block"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {hasVideo ? (
        <>
          <Typography variant="h6" component="h2">
            Видео
          </Typography>
          {videoUrl !== null ? (
            <>
              <Box
                sx={{
                  width: '100%',
                  maxHeight: 360,
                  bgcolor: 'common.black',
                  '& video': {
                    display: 'block',
                    width: '100%',
                    maxHeight: 360,
                  },
                }}
              >
                <video
                  ref={videoRef}
                  controls
                  preload="metadata"
                  src={videoUrl}
                  aria-label="Сохранённое видео"
                  onError={handlePlaybackError}
                />
              </Box>
              {videoDurationSec !== null ? (
                <Typography>
                  Длительность: {String(videoDurationSec)} с
                </Typography>
              ) : null}
              {playbackFailed ? (
                <Typography color="error">{PLAYBACK_FAILED}</Typography>
              ) : null}
            </>
          ) : urlMessages.length === 0 ? (
            <Typography>{FETCHING_URL}</Typography>
          ) : null}
          <ErrorMessages messages={deleteOpen ? [] : urlMessages} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {urlMessages.length > 0 ? (
              <Button variant="outlined" onClick={retryUrl}>
                Повторить
              </Button>
            ) : null}
            <Button
              variant="outlined"
              disabled={actionsLocked}
              onClick={openReplace}
            >
              Заменить видео
            </Button>
            {replacing ? (
              <Button
                variant="outlined"
                disabled={actionsLocked}
                onClick={cancelReplace}
              >
                Отменить замену
              </Button>
            ) : null}
            <Button
              variant="outlined"
              color="warning"
              disabled={actionsLocked}
              onClick={openDelete}
            >
              Удалить видео
            </Button>
          </Box>
        </>
      ) : null}
      {hasVideo ? (
        <>
          <Dialog open={replaceOpen} onClose={closeReplace}>
            <DialogTitle>Заменить видео?</DialogTitle>
            <DialogContent>
              <DialogContentText>{IRREVERSIBLE}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeReplace}>Отмена</Button>
              <Button variant="contained" onClick={continueReplace}>
                Продолжить
              </Button>
            </DialogActions>
          </Dialog>
          <Dialog
            open={deleteOpen}
            onClose={() => {
              if (!busy) {
                closeDelete();
              }
            }}
          >
            <DialogTitle>Удалить видео?</DialogTitle>
            <DialogContent>
              <DialogContentText>{IRREVERSIBLE}</DialogContentText>
              <ErrorMessages messages={deleteOpen ? deleteMessages : []} />
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDelete} disabled={busy}>
                Отмена
              </Button>
              <Button
                variant="contained"
                color="warning"
                disabled={busy}
                onClick={() => {
                  void confirmDelete();
                }}
              >
                Удалить
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : null}
      {!hasVideo || replacing ? editor : null}
    </Box>
  );
};
