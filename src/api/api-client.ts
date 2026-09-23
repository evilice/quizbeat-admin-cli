import { apiBaseUrl } from './api-base-url.ts';
import { ApiError, errorFromResponse } from './api-error.ts';

export type ApiRequest = {
  method: string;
  body?: BodyInit;
  headers?: HeadersInit;
  /**
   * `false` — без `Authorization` и без перехватчика `401`.
   * Для login / refresh / logout.
   */
  auth?: boolean;
  /**
   * Если вернул `true`, этот `401` не про access-токен:
   * без refresh и без очистки сессии. По умолчанию любой `401`
   * защищённого вызова идёт в refresh.
   */
  isNonTokenUnauthorized?: (error: ApiError) => boolean;
};

export type JsonRequest = {
  method: string;
  body?: unknown;
  auth?: boolean;
  isNonTokenUnauthorized?: (error: ApiError) => boolean;
};

export type CreateApiClientOptions = {
  /** Общий single-flight refresh. `false` — refresh-токена нет, исходный 401. */
  refresh?: () => Promise<boolean>;
  /** Повторный 401 после успешной ротации — как 401 самого refresh. */
  onAuthLost?: () => void;
};

export type ApiClient = {
  request(path: string, options: ApiRequest): Promise<unknown>;
  requestJson<T = unknown>(
    path: string,
    options: JsonRequest,
  ): Promise<T | undefined>;
};

export function createApiClient(
  getAccessToken: () => string | null,
  options: CreateApiClientOptions = {},
): ApiClient {
  const { refresh, onAuthLost } = options;

  async function request(
    path: string,
    requestOptions: ApiRequest,
  ): Promise<unknown> {
    return send(path, requestOptions, true);
  }

  function requestJson<T = unknown>(
    path: string,
    requestOptions: JsonRequest,
  ): Promise<T | undefined> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    return request(path, {
      method: requestOptions.method,
      headers,
      auth: requestOptions.auth,
      isNonTokenUnauthorized: requestOptions.isNonTokenUnauthorized,
      body:
        requestOptions.body === undefined
          ? undefined
          : JSON.stringify(requestOptions.body),
    }) as Promise<T | undefined>;
  }

  async function send(
    path: string,
    requestOptions: ApiRequest,
    allowRefresh: boolean,
  ): Promise<unknown> {
    const headers = new Headers(requestOptions.headers);
    const useAuth = requestOptions.auth !== false;

    if (useAuth) {
      const token = getAccessToken();
      if (token !== null && token !== '') {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        method: requestOptions.method,
        body: requestOptions.body,
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

    const error = errorFromResponse(response.status, raw);

    if (
      error.status === 401 &&
      useAuth &&
      allowRefresh &&
      refresh !== undefined
    ) {
      if (requestOptions.isNonTokenUnauthorized?.(error) === true) {
        throw error;
      }

      const refreshed = await refresh();

      if (!refreshed) {
        throw error;
      }

      try {
        return await send(path, requestOptions, false);
      } catch (retryError) {
        if (
          retryError instanceof ApiError &&
          retryError.status === 401 &&
          requestOptions.isNonTokenUnauthorized?.(retryError) !== true
        ) {
          onAuthLost?.();
        }
        throw retryError;
      }
    }

    throw error;
  }

  return { request, requestJson };
}
