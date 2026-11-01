import { makeAutoObservable } from 'mobx';
import {
  createApiClient,
  type ApiClient,
} from '../../shared/api/api-client.ts';
import { ApiError } from '../../shared/api/api-error.ts';
import { parseAccessToken, type StaffRole } from './parse-access-token.ts';

export const REFRESH_TOKEN_KEY = 'quizbeat.staff.refreshToken';
export const EMAIL_KEY = 'quizbeat.staff.email';

const REFRESH_PATH = '/auth/staff/refresh';

export type SessionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StaffAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export class SessionStore {
  accessToken: string | null = null;
  id: string | null = null;
  role: StaffRole | null = null;
  email: string | null = null;
  refreshToken: string | null = null;

  readonly api: ApiClient;

  private readonly storage: SessionStorage;
  #refreshInFlight: { epoch: number; promise: Promise<void> } | null = null;
  #loggingOut = false;
  /** Растёт при смене сессии; refresh из прошлой эпохи не пишется. */
  #epoch = 0;

  constructor(storage: SessionStorage) {
    this.storage = storage;
    this.refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
    this.email = storage.getItem(EMAIL_KEY);
    this.api = createApiClient(() => this.accessToken, {
      refresh: () => this.refreshAccess(),
      // Во время выхода 401 не должен стирать сессию раньше самого logout:
      // иначе поздний clear() затрёт уже новый вход.
      onAuthLost: () => {
        if (!this.#loggingOut) {
          this.clearTokens();
        }
      },
      getSessionEpoch: () => this.#epoch,
    });
    makeAutoObservable(
      this,
      {
        api: false,
      },
      { autoBind: true },
    );
  }

  setPair(accessToken: string, refreshToken: string, email?: string): void {
    this.applyPair(accessToken, refreshToken, email, true);
  }

  private applyPair(
    accessToken: string,
    refreshToken: string,
    email: string | undefined,
    newSession: boolean,
  ): void {
    const parsed = parseAccessToken(accessToken);
    if (parsed === null) {
      throw new ApiError(null, ['Сервер вернул недопустимый токен доступа']);
    }

    if (newSession) {
      // Новый вход делает недействительными запросы и refresh прошлой сессии.
      this.#epoch += 1;
      this.#refreshInFlight = null;
    }

    this.accessToken = accessToken;
    this.id = parsed.id;
    this.role = parsed.role;
    this.refreshToken = refreshToken;
    this.storage.setItem(REFRESH_TOKEN_KEY, refreshToken);

    if (email !== undefined) {
      this.email = email;
      this.storage.setItem(EMAIL_KEY, email);
    }
  }

  forgetRefresh(): void {
    this.refreshToken = null;
    this.storage.removeItem(REFRESH_TOKEN_KEY);
  }

  clearTokens(): void {
    this.#epoch += 1;
    this.#refreshInFlight = null;
    this.accessToken = null;
    this.id = null;
    this.role = null;
    this.refreshToken = null;
    this.storage.removeItem(REFRESH_TOKEN_KEY);
  }

  clear(): void {
    this.#epoch += 1;
    this.#refreshInFlight = null;
    this.accessToken = null;
    this.id = null;
    this.role = null;
    this.refreshToken = null;
    this.email = null;
    this.storage.removeItem(REFRESH_TOKEN_KEY);
    this.storage.removeItem(EMAIL_KEY);
  }

  async login(email: string, password: string): Promise<void> {
    const tokens = await this.api.requestJson<StaffAuthTokens>(
      '/auth/staff/login',
      {
        method: 'POST',
        body: { email, password },
        auth: false,
      },
    );
    if (
      tokens === undefined ||
      !tokens.accessToken ||
      !tokens.refreshToken
    ) {
      throw new ApiError(null, ['Сервер вернул пустую пару токенов']);
    }
    this.setPair(tokens.accessToken, tokens.refreshToken, email);
  }

  async restore(): Promise<void> {
    if (this.refreshToken === null || this.refreshToken === '') {
      return;
    }
    await this.runSharedRefresh();
  }

  async logout(): Promise<void> {
    const epoch = this.#epoch;
    this.#loggingOut = true;
    try {
      // Нельзя отзывать refresh, который вот-вот ротируется: иначе на
      // сервере останется жить только что выданный токен.
      const inFlight = this.#refreshInFlight;
      if (inFlight !== null && inFlight.epoch === epoch) {
        try {
          await inFlight.promise;
        } catch {
          // Ошибка refresh уже обработана в performRefresh.
        }
      }

      // Пока ждали refresh, могли войти заново или выйти из другой вкладки.
      if (this.#epoch !== epoch) {
        if (this.accessToken === null && this.refreshToken === null) {
          this.clear();
        }
        return;
      }

      const token = this.refreshToken;
      if (token === null || token === '') {
        this.clear();
        return;
      }

      try {
        await this.api.requestJson('/auth/staff/logout', {
          method: 'POST',
          body: { refreshToken: token },
          auth: false,
        });
      } catch {
        // 204, сеть, 401 — локально чистим в любом случае
      } finally {
        if (this.#epoch === epoch) {
          this.clear();
        }
      }
    } finally {
      this.#loggingOut = false;
    }
  }

  /** Для перехватчика: `false`, если refresh некуда слать. */
  async refreshAccess(): Promise<boolean> {
    if (this.#loggingOut) {
      return false;
    }
    if (this.refreshToken === null || this.refreshToken === '') {
      return false;
    }
    const epoch = this.#epoch;
    await this.runSharedRefresh();
    return (
      this.#epoch === epoch &&
      this.accessToken !== null &&
      this.refreshToken !== null
    );
  }

  private runSharedRefresh(): Promise<void> {
    const epoch = this.#epoch;
    if (
      this.#refreshInFlight !== null &&
      this.#refreshInFlight.epoch === epoch
    ) {
      return this.#refreshInFlight.promise;
    }

    const promise = this.performRefresh(epoch).finally(() => {
      if (this.#refreshInFlight?.epoch === epoch) {
        this.#refreshInFlight = null;
      }
    });
    this.#refreshInFlight = { epoch, promise };
    return promise;
  }

  private async performRefresh(epoch: number): Promise<void> {
    const refreshToken = this.refreshToken;
    if (refreshToken === null || refreshToken === '') {
      return;
    }

    let tokens: StaffAuthTokens | undefined;
    try {
      tokens = await this.api.requestJson<StaffAuthTokens>(REFRESH_PATH, {
        method: 'POST',
        body: { refreshToken },
        auth: false,
      });
    } catch (error) {
      if (
        epoch === this.#epoch &&
        refreshToken === this.refreshToken &&
        error instanceof ApiError &&
        error.status === 401
      ) {
        this.clearTokens();
      }
      throw error;
    }
    if (tokens === undefined || !tokens.accessToken || !tokens.refreshToken) {
      throw new ApiError(null, ['Пустой ответ refresh']);
    }
    if (epoch !== this.#epoch || refreshToken !== this.refreshToken) {
      // Пока шёл refresh, сессию сбросили (выход, смена пароля, новый вход).
      return;
    }
    try {
      this.applyPair(tokens.accessToken, tokens.refreshToken, undefined, false);
    } catch (error) {
      // Сервер уже ротировал refresh, а пара не разобралась: сессии нет.
      this.clearTokens();
      throw error;
    }
  }
}
