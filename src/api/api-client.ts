import { apiBaseUrl } from './api-base-url.ts';
import { ApiError, errorFromResponse } from './api-error.ts';

export type ApiRequest = {
  method: string;
  body?: BodyInit;
  headers?: HeadersInit;
};

export type JsonRequest = {
  method: string;
  body?: unknown;
};

export function createApiClient(getAccessToken: () => string | null) {
  async function request(path: string, options: ApiRequest): Promise<unknown> {
    const headers = new Headers(options.headers);
    const token = getAccessToken();
    if (token !== null && token !== '') {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        body: options.body,
        headers,
      });
    } catch {
      throw new ApiError(null, ['Не удалось связаться с сервером']);
    }

    const raw = await response.text();
    if (response.ok) {
      if (raw.trim() === '') {
        return undefined;
      }
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        throw new ApiError(response.status, [raw]);
      }
    }

    throw errorFromResponse(response.status, raw);
  }

  function requestJson<T = unknown>(
    path: string,
    options: JsonRequest,
  ): Promise<T | undefined> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    return request(path, {
      method: options.method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    }) as Promise<T | undefined>;
  }

  return { request, requestJson };
}
