import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RootStore } from '../../shared/store/root-store.ts';
import { RootStoreProvider } from '../../shared/store/root-store-context.tsx';
import type { SessionStorage } from '../session/session-store.ts';
import { useTagOptions } from './use-tag-options.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTagOptions', () => {
  it('собирает теги со всех страниц', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const page = Number(new URL(String(url)).searchParams.get('page'));
      const items = page === 1 ? [tag('a'), tag('b')] : [tag('c')];
      return Promise.resolve(
        new Response(JSON.stringify({ items, total: 3, page, limit: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTagOptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.tagOptions.map((item) => item.id)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.tagMessages).toEqual([]);
  });

  it('при ошибке отдаёт сообщение, а не молча пустой список', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );

    const { result } = renderHook(() => useTagOptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.tagMessages.length).toBeGreaterThan(0);
    });
    expect(result.current.tagOptions).toEqual([]);
  });
});

function tag(id: string) {
  return {
    id,
    code: id,
    translations: [
      { locale: 'ru', name: id },
      { locale: 'en', name: id },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function wrapper() {
  const store = new RootStore(memoryStorage());
  return ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>{children}</RootStoreProvider>
  );
}

function memoryStorage(): SessionStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
