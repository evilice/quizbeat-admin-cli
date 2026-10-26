import { describe, expect, it } from 'vitest';
import {
  MAX_VIDEO_CLIP_SEC,
  MIN_VIDEO_CLIP_SEC,
  boundsForSave,
  defaultBounds,
  parseBound,
  roundDownSec,
  roundSec,
  validateBounds,
} from './video-trim.ts';

describe('границы видеоотрезка', () => {
  it('максимум 60 с и минимум 0,1 с — зеркало серверных констант', () => {
    expect(MAX_VIDEO_CLIP_SEC).toBe(60);
    expect(MIN_VIDEO_CLIP_SEC).toBe(0.1);
  });

  it('по умолчанию отрезок от начала до min(длительность, 60)', () => {
    expect(defaultBounds(12)).toEqual({ start: 0, end: 12 });
    expect(defaultBounds(60)).toEqual({ start: 0, end: 60 });
    expect(defaultBounds(90)).toEqual({ start: 0, end: 60 });
    expect(defaultBounds(4.996)).toEqual({ start: 0, end: 4.996 });
  });

  it('округляет секунды до сотых', () => {
    expect(roundSec(1.254)).toBe(1.25);
    expect(roundSec(1.256)).toBe(1.26);
    expect(roundSec(0.1 + 0.2)).toBe(0.3);
    expect(roundSec(4.996)).toBe(5);
  });

  it('округляет вниз, не теряя уже ровные сотые', () => {
    expect(roundDownSec(4.996)).toBe(4.99);
    expect(roundDownSec(0.29)).toBe(0.29);
    expect(roundDownSec(9.9996)).toBe(9.99);
  });

  it('пустая строка не становится нулём', () => {
    expect(parseBound('')).toBeNaN();
    expect(parseBound('   ')).toBeNaN();
    expect(parseBound('0')).toBe(0);
    expect(parseBound(' 1.5 ')).toBe(1.5);
  });

  it('отклоняет нечисло, отрицательное начало, конец не позже начала и короткую длину', () => {
    expect(validateBounds(Number.NaN, 1, 10)).toBe('Начало и конец — числа');
    expect(validateBounds(0, Number.POSITIVE_INFINITY, 10)).toBe(
      'Начало и конец — числа',
    );
    expect(validateBounds(parseBound(''), 1, 10)).toBe(
      'Начало и конец — числа',
    );
    expect(validateBounds(-0.01, 1, 10)).toBe('Начало не меньше 0');
    expect(validateBounds(2, 2, 10)).toBe('Конец должен быть позже начала');
    expect(validateBounds(2, 1.5, 10)).toBe('Конец должен быть позже начала');
    expect(validateBounds(0, 0.05, 10)).toBe('Длина отрезка не меньше 0,1 с');
  });

  it('принимает длину 0,1 с даже там, где сырой float короче', () => {
    expect(validateBounds(0, 0.1, 10)).toBeNull();
    expect(validateBounds(1.1, 1.2, 10)).toBeNull();
    expect(1.2 - 1.1).toBeLessThan(0.1);
  });

  it('отклоняет длину больше 60 с и конец за длительностью ролика', () => {
    expect(validateBounds(0, 60, 90)).toBeNull();
    expect(validateBounds(0, 60.001, 90)).toBe('Длина отрезка не больше 60 с');
    expect(validateBounds(0, 12, 10)).toBe('Конец не позже длительности видео');
    expect(validateBounds(0, 10, 10)).toBeNull();
  });

  it('после округления зажимает конец, который иначе вышел бы за ролик', () => {
    expect(boundsForSave(0, 4.996, 4.996)).toEqual({
      startSec: 0,
      endSec: 4.99,
    });
    expect(validateBounds(0, 4.996, 4.996)).toBeNull();
    expect(validateBounds(0, 5, 4.996)).toBe(
      'Конец не позже длительности видео',
    );
  });

  it('оставляет округление, если серверные миллисекунды всё ещё внутри ролика', () => {
    expect(boundsForSave(0, 9.9996, 9.9996)).toEqual({
      startSec: 0,
      endSec: 10,
    });
    expect(validateBounds(0, 10, 9.9996)).toBeNull();
    expect(validateBounds(0, 9.9996, 9.9996)).toBeNull();
  });

  it('не зажимает конец, который длиннее ролика ещё до округления', () => {
    expect(boundsForSave(0, 5, 4.996)).toEqual({ startSec: 0, endSec: 5 });
  });

  it('после округления короткий хвост уже не дотягивает до 0,1 с', () => {
    const saved = boundsForSave(4.896, 4.996, 4.996);
    expect(saved).toEqual({ startSec: 4.9, endSec: 4.99 });
    expect(validateBounds(4.896, 4.996, 4.996)).toBeNull();
    expect(validateBounds(saved.startSec, saved.endSec, 4.996)).toBe(
      'Длина отрезка не меньше 0,1 с',
    );
  });
});
