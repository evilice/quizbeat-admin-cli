const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export function resolveApiBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (withoutTrailingSlash === '') {
    return DEFAULT_API_BASE_URL;
  }
  return withoutTrailingSlash;
}

export const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
