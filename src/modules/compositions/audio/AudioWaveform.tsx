import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

export function AudioWaveform({
  url,
  onPick,
  onError,
  onReady,
}: {
  url: string;
  onPick: (relativeX: number) => void;
  onError: () => void;
  onReady: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onPickRef.current = onPick;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const wave = WaveSurfer.create({
      container,
      url,
      height: 80,
      waveColor: '#90caf9',
      progressColor: '#1565c0',
      cursorColor: '#0d47a1',
    });
    wave.on('click', (relativeX) => {
      onPickRef.current(relativeX);
    });
    wave.on('error', () => {
      onErrorRef.current();
    });
    wave.on('ready', () => {
      onReadyRef.current();
    });

    return () => {
      wave.destroy();
    };
  }, [url]);

  return (
    <Box
      ref={containerRef}
      data-testid="audio-waveform"
      data-audio-url={url}
      aria-label="Волновая форма"
      sx={{ width: '100%' }}
    />
  );
}
