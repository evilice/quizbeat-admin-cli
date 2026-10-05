import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router';
import { ErrorMessages } from '../../shared/ui/ErrorMessages.tsx';
import { AudioUploadBlock } from './audio/AudioUploadBlock.tsx';
import { ClipsListBlock } from './audio/ClipsListBlock.tsx';
import { WaveformPointsBlock } from './audio/WaveformPointsBlock.tsx';
import { CompositionCardTabs } from './card/CompositionCardTabs.tsx';
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
    tab,
    setTab,
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

  const heading = [headerTitle, headerAuthor].filter(Boolean).join(' — ');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {heading !== '' ? (
        <Typography variant="h5" component="h1">
          {heading}
        </Typography>
      ) : null}
      <ErrorMessages messages={tagMessages} />
      <CompositionCardTabs
        value={tab}
        onChange={setTab}
        general={
          <CompositionEditForm
            composition={full}
            tagOptions={tagOptions}
            onSaved={applySaved}
          />
        }
        audio={
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 4,
              alignItems: 'start',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 0,
              }}
            >
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
                active={tab === 'audio'}
                onPointsCreated={handlePointsCreated}
              />
            </Box>
            <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
              <ClipsListBlock
                compositionId={full.id}
                initialClips={full.clips}
                reloadToken={clipsReloadToken}
                active={tab === 'audio'}
              />
            </Box>
          </Box>
        }
        images={
          <ImagesBlock compositionId={full.id} initialImages={full.images} />
        }
        notes={<NotesBlock compositionId={full.id} initialNotes={full.notes} />}
      />
    </Box>
  );
});
