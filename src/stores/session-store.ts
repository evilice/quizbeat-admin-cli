import { makeAutoObservable } from 'mobx';
import {
  parseAccessToken,
  type StaffRole,
} from './parse-access-token.ts';

export const REFRESH_TOKEN_KEY = 'quizbeat.staff.refreshToken';
export const EMAIL_KEY = 'quizbeat.staff.email';

export type SessionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export class SessionStore {
  accessToken: string | null = null;
  id: string | null = null;
  role: StaffRole | null = null;
  email: string | null = null;
  refreshToken: string | null = null;

  private readonly storage: SessionStorage;

  constructor(storage: SessionStorage) {
    this.storage = storage;
    this.refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
    this.email = storage.getItem(EMAIL_KEY);
    makeAutoObservable(this, undefined, { autoBind: true });
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
}
