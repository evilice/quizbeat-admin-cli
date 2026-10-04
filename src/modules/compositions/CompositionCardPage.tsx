import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { AudioUploadBlock } from './audio/AudioUploadBlock.tsx';
import { ClipsListBlock } from './audio/ClipsListBlock.tsx';
import { WaveformPointsBlock } from './audio/WaveformPointsBlock.tsx';
import { useCompositionCard } from './card/use-composition-card.ts';
import { COMPOSITION_NOT_FOUND_MESSAGE } from './composition-display.ts';
import { CompositionEditForm } from './edit/CompositionEditForm.tsx';
import { ImagesBlock } from './images/ImagesBlock.tsx';
import { NotesBlock } from './notes/NotesBlock.tsx';

export const CompositionCardPage = observer(() => {
  const {
    notFound,
    loading,
    loadMessages,
    headerTitle,
    headerAuthor,
    full,
    tagOptions,
    tagMessages,
    clipsReloadToken,
    audioVersion,
    applySaved,
    handleAudioUploaded,
    handlePointsCreated,
  } = useCompositionCard();

  if (notFound) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography>{COMPOSITION_NOT_FOUND_MESSAGE}</Typography>
        <Button component={Link} to="/compositions">
          К списку композиций
        </Button>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {headerTitle !== undefined || headerAuthor !== undefined ? (
          <Typography variant="h5" component="h1">
            {[headerTitle, headerAuthor].filter(Boolean).join(' — ')}
          </Typography>
        ) : null}
        <CircularProgress aria-label="Загрузка композиции" />
      </Box>
    );
  }

  if (loadMessages.length > 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ErrorMessages messages={loadMessages} />
        <Button component={Link} to="/compositions">
          К списку композиций
        </Button>
      </Box>
    );
  }

  if (full === null) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <ErrorMessages messages={tagMessages} />
      <CompositionEditForm
        composition={full}
        tagOptions={tagOptions}
        onSaved={applySaved}
      />
      <AudioUploadBlock
        compositionId={full.id}
        originalAudioUrl={full.originalAudioUrl}
        originalAudioDurationSec={full.originalAudioDurationSec}
        onUploaded={handleAudioUploaded}
      />
      <WaveformPointsBlock
        compositionId={full.id}
        originalAudioUrl={full.originalAudioUrl}
        originalAudioDurationSec={full.originalAudioDurationSec}
        audioVersion={audioVersion}
        onPointsCreated={handlePointsCreated}
      />
      <ClipsListBlock
        compositionId={full.id}
        initialClips={full.clips}
        reloadToken={clipsReloadToken}
      />
      <ImagesBlock compositionId={full.id} initialImages={full.images} />
      <NotesBlock compositionId={full.id} initialNotes={full.notes} />
    </Box>
  );
});
