import { AdminsStore } from './admins-store.ts';
import { AudioClipsStore } from './audio-clips-store.ts';
import { CompositionsStore } from './compositions-store.ts';
import { SessionStore, type SessionStorage } from './session-store.ts';
import { TagsStore } from './tags-store.ts';
import type { ApiClient } from '../api/api-client.ts';

export class RootStore {
  readonly session: SessionStore;
  readonly admins: AdminsStore;
  readonly tags: TagsStore;
  readonly compositions: CompositionsStore;
  readonly audioClips: AudioClipsStore;
  readonly api: ApiClient;

  constructor(storage: SessionStorage) {
    this.session = new SessionStore(storage);
    this.api = this.session.api;
    this.admins = new AdminsStore(this.api);
    this.tags = new TagsStore(this.api);
    this.compositions = new CompositionsStore(this.api);
    this.audioClips = new AudioClipsStore(this.api);
  }
}
