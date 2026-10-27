import { describe, expect, it } from 'vitest';
import { formatBytes, prefixLabel } from './storage-display.ts';

describe('formatBytes', () => {
  it('ноль и граница килобайта', () => {
    expect(formatBytes(0)).toBe('0 Б');
    expect(formatBytes(1023)).toBe('1023 Б');
    expect(formatBytes(1024)).toBe('1 КБ');
    expect(formatBytes(1536)).toBe('1,5 КБ');
  });

  it('граница мегабайта и гигабайта, выше гигабайта единица не меняется', () => {
    expect(formatBytes(1024 * 1024 - 1)).toBe('1 МБ');
    expect(formatBytes(1024 * 1024)).toBe('1 МБ');
    expect(formatBytes(1024 ** 3 - 1)).toBe('1 ГБ');
    expect(formatBytes(1024 ** 3)).toBe('1 ГБ');
    expect(formatBytes(1024 ** 4)).toBe(
      `${(1024).toLocaleString('ru-RU', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      })} ГБ`,
    );
  });
});

describe('prefixLabel', () => {
  it('известный префикс переводится, остальные и унаследованные имена — как есть', () => {
    expect(prefixLabel('images')).toBe('Картинки');
    expect(prefixLabel('other')).toBe('other');
    expect(prefixLabel('constructor')).toBe('constructor');
    expect(prefixLabel('toString')).toBe('toString');
  });
});
