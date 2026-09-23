import { SessionStore, type SessionStorage } from './session-store.ts';

export class RootStore {
  readonly session: SessionStore;

  constructor(storage: SessionStorage) {
    this.session = new SessionStore(storage);
  }
}
