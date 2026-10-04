import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttemptThrottle } from './use-attempt-throttle.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAttemptThrottle', () => {
  it('пускает одну попытку на ключ за интервал и снова — после него', () => {
    const { result } = renderHook(() => useAttemptThrottle(1000));

    expect(result.current('a')).toBe(true);
    expect(result.current('a')).toBe(false);
    expect(result.current('b')).toBe(true);

    vi.advanceTimersByTime(1000);

    expect(result.current('a')).toBe(true);
  });
});
