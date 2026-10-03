import { describe, expect, it } from 'vitest';
import { ApiError, messagesFromError } from './api-error.ts';

describe('messagesFromError', () => {
  it('отдаёт тексты ApiError', () => {
    expect(messagesFromError(new ApiError(409, ['Занято']))).toEqual([
      'Занято',
    ]);
  });

  it('для пустого ApiError и чужих ошибок отдаёт общее сообщение', () => {
    expect(messagesFromError(new ApiError(500, []))).toEqual([
      'Непредвиденная ошибка',
    ]);
    expect(messagesFromError(new TypeError('boom'))).toEqual([
      'Непредвиденная ошибка',
    ]);
  });
});
