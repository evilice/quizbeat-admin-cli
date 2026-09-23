import { SessionStore, type SessionStorage } from './session-store.ts';
import type { ApiClient } from '../api/api-client.ts';

export class RootStore {
  readonly session: SessionStore;
  readonly api: ApiClient;

  constructor(storage: SessionStorage) {
    this.session = new SessionStore(storage);
    this.api = this.session.api;
  }
}
