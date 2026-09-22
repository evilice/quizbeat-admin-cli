import { ruRU } from '@mui/material/locale';
import { useTheme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { RootStore } from '../stores/root-store.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { AppProviders } from './App.tsx';
import { routes } from './routes.tsx';

afterEach(() => {
  cleanup();
});

describe('оболочка', () => {
  it('на / показывает заголовок и не показывает поля входа', () => {
    renderAt('/');

    expect(
      screen.getByRole('heading', { name: 'Админка QuizBeat' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByLabelText(/пароль/i)).toBeNull();
  });

  it('хук стора возвращает экземпляр корневого стора', () => {
    const store = new RootStore();

    render(shell(store, '/', <StoreProbe expected={store} />));

    expect(screen.getByTestId('store-probe').textContent).toBe('same');
  });

  it('локаль темы совпадает с ruRU установленного пакета', () => {
    render(shell(new RootStore(), '/', <ThemeProbe />));

    expect(screen.getByTestId('theme-probe').textContent).toBe('match');
  });

  it('неизвестный путь показывает оболочку и пометку, что адреса нет', () => {
    renderAt('/missing');

    expect(
      screen.getByRole('heading', { name: 'Админка QuizBeat' }),
    ).toBeTruthy();
    expect(screen.getByText('Такого адреса нет.')).toBeTruthy();
  });
});

function renderAt(path: string): void {
  render(shell(new RootStore(), path));
}

function shell(store: RootStore, path: string, probe?: ReactNode) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return (
    <AppProviders store={store}>
      {probe}
      <RouterProvider router={router} />
    </AppProviders>
  );
}

function StoreProbe({ expected }: { expected: RootStore }) {
  const store = useRootStore();
  return (
    <span data-testid="store-probe">
      {store === expected ? 'same' : 'other'}
    </span>
  );
}

function ThemeProbe() {
  const current = useTheme();
  const matches = includesLocale(current, ruRU);
  return <span data-testid="theme-probe">{matches ? 'match' : 'miss'}</span>;
}

function includesLocale(value: unknown, expected: unknown): boolean {
  if (typeof expected === 'function') {
    return value === expected;
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(value) &&
      expected.every((item, index) => includesLocale(value[index], item))
    );
  }
  if (isRecord(expected)) {
    if (!isRecord(value)) {
      return false;
    }
    return Object.entries(expected).every(([key, item]) =>
      includesLocale(value[key], item),
    );
  }
  return value === expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
