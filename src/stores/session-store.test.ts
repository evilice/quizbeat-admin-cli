import { describe, expect, it } from 'vitest';
import { makeAccessToken } from './make-access-token.ts';
import {
  EMAIL_KEY,
  REFRESH_TOKEN_KEY,
  SessionStore,
  type SessionStorage,
} from './session-store.ts';

describe('SessionStore', () => {
  it('установка пары пишет refresh и email и не пишет access', () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    const access = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });

    store.setPair(access, 'refresh-1', 'a@example.com');

    expect(store.accessToken).toBe(access);
    expect(store.id).toBe('admin-1');
    expect(store.role).toBe('ADMIN');
    expect(store.email).toBe('a@example.com');
    expect(store.refreshToken).toBe('refresh-1');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    expect(storage.getItem(EMAIL_KEY)).toBe('a@example.com');
    expect(storageValues(storage).includes(access)).toBe(false);
  });

  it('повторная установка без email оставляет прежний email и меняет refresh', () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    const first = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });
    const second = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });

    store.setPair(first, 'refresh-1', 'a@example.com');
    store.setPair(second, 'refresh-2');

    expect(store.email).toBe('a@example.com');
    expect(storage.getItem(EMAIL_KEY)).toBe('a@example.com');
    expect(store.refreshToken).toBe('refresh-2');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
    expect(store.accessToken).toBe(second);
  });

  it('забыть refresh оставляет access в памяти и удаляет ключ refresh', () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    const access = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });

    store.setPair(access, 'refresh-1', 'a@example.com');
    store.forgetRefresh();

    expect(store.accessToken).toBe(access);
    expect(store.id).toBe('admin-1');
    expect(store.role).toBe('ADMIN');
    expect(store.email).toBe('a@example.com');
    expect(store.refreshToken).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(storage.getItem(EMAIL_KEY)).toBe('a@example.com');
  });

  it('сброс access и refresh сохраняет email', () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    const access = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });

    store.setPair(access, 'refresh-1', 'a@example.com');
    store.clearTokens();

    expect(store.accessToken).toBeNull();
    expect(store.id).toBeNull();
    expect(store.role).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.email).toBe('a@example.com');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(storage.getItem(EMAIL_KEY)).toBe('a@example.com');
  });

  it('полная очистка удаляет оба ключа', () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    const access = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });

    store.setPair(access, 'refresh-1', 'a@example.com');
    store.clear();

    expect(store.accessToken).toBeNull();
    expect(store.id).toBeNull();
    expect(store.role).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.email).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(storage.getItem(EMAIL_KEY)).toBeNull();
  });

  it('не записывает сессию, если access не разбирается', () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    const valid = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });

    store.setPair(valid, 'refresh-1', 'a@example.com');
    store.setPair(
      makeAccessToken({ sub: 'x', role: 'ADMIN', type: 'player' }),
      'refresh-bad',
      'other@example.com',
    );

    expect(store.accessToken).toBe(valid);
    expect(store.refreshToken).toBe('refresh-1');
    expect(store.email).toBe('a@example.com');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    expect(storage.getItem(EMAIL_KEY)).toBe('a@example.com');
  });

  it('при создании читает refresh и email, но не выдумывает access', () => {
    const storage = createMemoryStorage({
      [REFRESH_TOKEN_KEY]: 'stored-refresh',
      [EMAIL_KEY]: 'stored@example.com',
    });

    const store = new SessionStore(storage);

    expect(store.refreshToken).toBe('stored-refresh');
    expect(store.email).toBe('stored@example.com');
    expect(store.accessToken).toBeNull();
    expect(store.id).toBeNull();
    expect(store.role).toBeNull();
  });
});

function createMemoryStorage(
  initial: Record<string, string> = {},
): SessionStorage & { entries: Map<string, string> } {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
  };
}

function storageValues(storage: { entries: Map<string, string> }): string[] {
  return [...storage.entries.values()];
}
