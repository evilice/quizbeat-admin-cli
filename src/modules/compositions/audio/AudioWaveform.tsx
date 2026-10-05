import { Box } from '@mui/material';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import WaveSurfer from 'wavesurfer.js';

export type AudioWaveformHandle = {
  playFrom: (startSec: number) => Promise<void>;
  pause: () => void;
};

export function AudioWaveform({
  url,
  endSec,
  onPick,
  onError,
  onReady,
  onLoadStart,
  onPlayingChange,
  ref,
}: {
  url: string;
  /** Секунда, на которой воспроизведение отрезка нужно остановить. */
  endSec: number | null;
  onPick: (relativeX: number) => void;
  onError: () => void;
  onReady: () => void;
  onLoadStart: () => void;
  onPlayingChange: (playing: boolean) => void;
  ref?: Ref<AudioWaveformHandle>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const onPickRef = useRef(onPick);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const onLoadStartRef = useRef(onLoadStart);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const endSecRef = useRef(endSec);

  useEffect(() => {
    onPickRef.current = onPick;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
    onLoadStartRef.current = onLoadStart;
    onPlayingChangeRef.current = onPlayingChange;
    endSecRef.current = endSec;
  });

  useImperativeHandle(ref, () => ({
    playFrom(startSec: number) {
      const wave = waveRef.current;
      if (wave === null) {
        return Promise.resolve();
      }
      return wave.play(startSec);
    },
    pause() {
      const wave = waveRef.current;
      if (wave !== null && wave.isPlaying()) {
        wave.pause();
      }
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    onLoadStartRef.current();

    const wave = WaveSurfer.create({
      container,
      url,
      height: 80,
      waveColor: '#b0bec5',
      progressColor: '#b0bec5',
      cursorColor: '#0d47a1',
    });
    waveRef.current = wave;
    wave.on('click', (relativeX) => {
      onPickRef.current(relativeX);
    });
    wave.on('error', () => {
      onErrorRef.current();
    });
    wave.on('ready', () => {
      onReadyRef.current();
    });
    wave.on('play', () => {
      onPlayingChangeRef.current(true);
    });
    wave.on('pause', () => {
      onPlayingChangeRef.current(false);
    });
    wave.on('finish', () => {
      onPlayingChangeRef.current(false);
    });
    wave.on('timeupdate', (currentTime) => {
      const end = endSecRef.current;
      if (end === null || !wave.isPlaying() || currentTime < end) {
        return;
      }
      wave.pause();
    });

    return () => {
      waveRef.current = null;
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
