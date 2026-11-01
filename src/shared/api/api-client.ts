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

export type FormRequest = {
  method: string;
  body: FormData;
  auth?: boolean;
};

export type CreateApiClientOptions = {
  /** Общий single-flight refresh. `false` — refresh-токена нет, исходный 401. */
  refresh?: () => Promise<boolean>;
  /** Повторный 401 после успешной ротации — как 401 самого refresh. */
  onAuthLost?: () => void;
  /**
   * Номер эпохи сессии. Запрос, отправленный в прошлой сессии, не повторяется
   * и не завершает новую сессию, если за время ожидания вошли другим
   * сотрудником.
   */
  getSessionEpoch?: () => number;
};

export type ApiClient = {
  request(path: string, options: ApiRequest): Promise<unknown>;
  requestJson<T = unknown>(
    path: string,
    options: JsonRequest,
  ): Promise<T | undefined>;
  requestForm<T = unknown>(
    path: string,
    options: FormRequest,
  ): Promise<T | undefined>;
};

export function createApiClient(
  getAccessToken: () => string | null,
  options: CreateApiClientOptions = {},
): ApiClient {
  const { refresh, onAuthLost, getSessionEpoch } = options;
  const sessionEpoch = (): number => getSessionEpoch?.() ?? 0;

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

  function requestForm<T = unknown>(
    path: string,
    requestOptions: FormRequest,
  ): Promise<T | undefined> {
    return request(path, {
      method: requestOptions.method,
      body: requestOptions.body,
      auth: requestOptions.auth,
    }) as Promise<T | undefined>;
  }

  async function send(
    path: string,
    requestOptions: ApiRequest,
    allowRefresh: boolean,
  ): Promise<unknown> {
    const headers = new Headers(requestOptions.headers);
    const useAuth = requestOptions.auth !== false;
    const sentToken = useAuth ? getAccessToken() : null;
    const sentEpoch = sessionEpoch();

    if (sentToken !== null && sentToken !== '') {
      headers.set('Authorization', `Bearer ${sentToken}`);
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

    let raw: string;
    try {
      raw = await response.text();
    } catch {
      throw new ApiError(null, ['Не удалось связаться с сервером']);
    }
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

      // Пока запрос ждал ответа, сессию могли завершить или заменить входом
      // другого сотрудника. Повтор с чужим токеном недопустим: мутация
      // выполнилась бы от имени новой сессии.
      if (sessionEpoch() !== sentEpoch) {
        throw error;
      }

      // Токен уже заменили, пока шёл запрос: ротацию сделал другой 401,
      // второй refresh не нужен.
      const alreadyRotated = getAccessToken() !== sentToken;

      if (!alreadyRotated) {
        const refreshed = await refresh();

        if (!refreshed) {
          // Refresh слать некуда, access мёртв: сессия потеряна.
          if (sessionEpoch() === sentEpoch) {
            onAuthLost?.();
          }
          throw error;
        }
      }

      if (sessionEpoch() !== sentEpoch) {
        throw error;
      }

      try {
        return await send(path, requestOptions, false);
      } catch (retryError) {
        if (
          sessionEpoch() === sentEpoch &&
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

  return { request, requestJson, requestForm };
}
