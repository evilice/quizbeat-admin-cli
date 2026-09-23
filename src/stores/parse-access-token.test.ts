import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeAccessToken } from './make-access-token.ts';
import { parseAccessToken } from './parse-access-token.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseAccessToken', () => {
  it('разбирает валидный staff-токен с ролью ADMIN', () => {
    const token = makeAccessToken({
      sub: 'admin-1',
      role: 'ADMIN',
      type: 'staff',
    });

    expect(parseAccessToken(token)).toEqual({
      id: 'admin-1',
      role: 'ADMIN',
    });
  });

  it('разбирает валидный staff-токен с ролью SUPER_ADMIN и base64url-символами в payload', () => {
    // sub с не-ASCII даёт «-» в base64url после кодирования — замена алфавита не мёртвая
    const token = makeAccessToken({
      sub: 'сотрудник-\u00ff\u00fe',
      role: 'SUPER_ADMIN',
      type: 'staff',
    });

    expect(parseAccessToken(token)).toEqual({
      id: 'сотрудник-\u00ff\u00fe',
      role: 'SUPER_ADMIN',
    });
  });

  it('отказывает на player-type', () => {
    const token = makeAccessToken({
      sub: 'player-1',
      role: 'ADMIN',
      type: 'player',
    });

    expect(parseAccessToken(token)).toBeNull();
  });

  it('отказывает на пустом sub', () => {
    const token = makeAccessToken({
      sub: '',
      role: 'ADMIN',
      type: 'staff',
    });

    expect(parseAccessToken(token)).toBeNull();
  });

  it('отказывает на роли вне ADMIN и SUPER_ADMIN', () => {
    const token = makeAccessToken({
      sub: 'admin-1',
      role: 'PLAYER',
      type: 'staff',
    });

    expect(parseAccessToken(token)).toBeNull();
  });

  it('отказывает на битой строке', () => {
    expect(parseAccessToken('not-a-jwt')).toBeNull();
    expect(parseAccessToken('only.two')).toBeNull();
    expect(parseAccessToken('a.!!!not-json!!!.c')).toBeNull();
  });

  it('передаёт в atob payload с паддингом до длины, кратной 4', () => {
    const token = makeAccessToken({
      sub: 'a',
      role: 'ADMIN',
      type: 'staff',
    });
    const payloadSegment = token.split('.')[1];
    expect(payloadSegment).toBeDefined();
    expect(payloadSegment!.length % 4).not.toBe(0);

    const realAtob = globalThis.atob.bind(globalThis);
    const atobMock = vi.fn((value: string) => realAtob(value));
    vi.stubGlobal('atob', atobMock);

    expect(parseAccessToken(token)).toEqual({ id: 'a', role: 'ADMIN' });

    expect(atobMock).toHaveBeenCalledTimes(1);
    const passed = atobMock.mock.calls[0]?.[0];
    expect(typeof passed).toBe('string');
    expect((passed as string).length % 4).toBe(0);
    expect(passed).toBe(
      payloadSegment!.replace(/-/g, '+').replace(/_/g, '/') +
        '='.repeat((4 - (payloadSegment!.length % 4)) % 4),
    );
  });
});
