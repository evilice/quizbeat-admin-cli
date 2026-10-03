import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './api-base-url.ts';

describe('resolveApiBaseUrl', () => {
  it('возвращает дефолт, если значение не задано', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://localhost:3000');
  });

  it('возвращает дефолт для пустой строки и пробелов', () => {
    expect(resolveApiBaseUrl('')).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl('   ')).toBe('http://localhost:3000');
  });

  it('срезает завершающий слэш', () => {
    expect(resolveApiBaseUrl('http://localhost:3000/')).toBe(
      'http://localhost:3000',
    );
  });

  it('оставляет обычный URL без изменений', () => {
    expect(resolveApiBaseUrl('https://api.example.com')).toBe(
      'https://api.example.com',
    );
  });
});
