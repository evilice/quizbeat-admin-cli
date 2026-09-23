import { makeAutoObservable } from 'mobx';
import {
  createApiClient,
  type ApiClient,
} from '../api/api-client.ts';
import { ApiError } from '../api/api-error.ts';
import {
  parseAccessToken,
  type StaffRole,
} from './parse-access-token.ts';

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
  #refreshInFlight: Promise<void> | null = null;

  constructor(storage: SessionStorage) {
    this.storage = storage;
    this.refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
    this.email = storage.getItem(EMAIL_KEY);
    this.api = createApiClient(() => this.accessToken, {
      refresh: () => this.refreshAccess(),
      onAuthLost: () => this.clearTokens(),
    });
    makeAutoObservable(
      this,
      {
        api: false,
      },
      { autoBind: true },
    );
  }

  setPair(
    accessToken: string,
    refreshToken: string,
    email?: string,
  ): void {
    const parsed = parseAccessToken(accessToken);
    if (parsed === null) {
      return;
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
    this.accessToken = null;
    this.id = null;
    this.role = null;
    this.refreshToken = null;
    this.storage.removeItem(REFRESH_TOKEN_KEY);
  }

  clear(): void {
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
    if (tokens === undefined) {
      return;
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
      this.clear();
    }
  }

  /** Для перехватчика: `false`, если refresh некуда слать. */
  async refreshAccess(): Promise<boolean> {
    if (this.refreshToken === null || this.refreshToken === '') {
      return false;
    }
    await this.runSharedRefresh();
    return true;
  }

  private runSharedRefresh(): Promise<void> {
    if (this.#refreshInFlight !== null) {
      return this.#refreshInFlight;
    }
    this.#refreshInFlight = this.performRefresh().finally(() => {
      this.#refreshInFlight = null;
    });
    return this.#refreshInFlight;
  }

  private async performRefresh(): Promise<void> {
    const refreshToken = this.refreshToken;
    if (refreshToken === null || refreshToken === '') {
      return;
    }

    try {
      const tokens = await this.api.requestJson<StaffAuthTokens>(REFRESH_PATH, {
        method: 'POST',
        body: { refreshToken },
        auth: false,
      });
      if (tokens === undefined) {
        throw new ApiError(null, ['Пустой ответ refresh']);
      }
      this.setPair(tokens.accessToken, tokens.refreshToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.clearTokens();
      }
      throw error;
    }
  }
}
