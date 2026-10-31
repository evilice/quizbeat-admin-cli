import { describe, expect, it } from 'vitest';
import { artistNames, compositionHeading } from './composition-display.ts';

const QUEEN = { id: 'artist-1', name: 'Queen' };
const ADAM = { id: 'artist-2', name: 'Adam Lambert' };

describe('artistNames', () => {
  it('несколько имён идут через запятую в заданном порядке', () => {
    expect(artistNames([QUEEN, ADAM])).toBe('Queen, Adam Lambert');
    expect(artistNames([ADAM, QUEEN])).toBe('Adam Lambert, Queen');
  });

  it('пустой список — «—»', () => {
    expect(artistNames([])).toBe('—');
  });
});

describe('compositionHeading', () => {
  it('с исполнителями — название и имена через тире', () => {
    expect(compositionHeading('Song', [QUEEN, ADAM])).toBe(
      'Song — Queen, Adam Lambert',
    );
  });

  it('без исполнителей — только название, без второго тире', () => {
    expect(compositionHeading('Song', [])).toBe('Song');
    expect(compositionHeading('Song', undefined)).toBe('Song');
  });

  it('без названия заголовок пустой', () => {
    expect(compositionHeading(undefined, [QUEEN])).toBe('');
    expect(compositionHeading('', [])).toBe('');
  });
});
