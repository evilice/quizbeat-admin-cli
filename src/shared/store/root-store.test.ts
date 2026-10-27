import { runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';
import { makeAccessToken } from '../testing/make-access-token.ts';
import type { SessionStorage } from '../../modules/session/session-store.ts';
import { RootStore } from './root-store.ts';

describe('RootStore', () => {
  it('потеря сессии сбрасывает состояние очистки хранилища', () => {
    const entries = new Map<string, string>();
    const memory: SessionStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => void entries.set(key, value),
      removeItem: (key) => void entries.delete(key),
    };
    const root = new RootStore(memory);
    root.session.setPair(
      makeAccessToken({ sub: 'sa-1', role: 'SUPER_ADMIN', type: 'staff' }),
      'refresh',
      'sa@example.com',
    );
    runInAction(() => {
      root.storage.messages = ['остаток'];
      root.storage.outcome = {
        applied: true,
        byPrefix: [],
        total: { count: 1, bytes: 1 },
        failed: 0,
        failedBytes: 0,
      };
    });

    root.session.clear();

    expect(root.storage.messages).toEqual([]);
    expect(root.storage.outcome).toBeNull();
    expect(root.storage.previewResult).toBeNull();
  });
});
