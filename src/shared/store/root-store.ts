import { AdminsStore } from '../../modules/admins/admins-store.ts';
import { AudioClipsStore } from '../../modules/compositions/audio/audio-clips-store.ts';
import { CompositionsStore } from '../../modules/compositions/compositions-store.ts';
import { ImagesStore } from '../../modules/compositions/images/images-store.ts';
import { NotesStore } from '../../modules/compositions/notes/notes-store.ts';
import {
  SessionStore,
  type SessionStorage,
} from '../../modules/session/session-store.ts';
import { TagsStore } from '../../modules/tags/tags-store.ts';
import type { ApiClient } from '../api/api-client.ts';

export class RootStore {
  readonly session: SessionStore;
  readonly admins: AdminsStore;
  readonly tags: TagsStore;
  readonly compositions: CompositionsStore;
  readonly audioClips: AudioClipsStore;
  readonly images: ImagesStore;
  readonly notes: NotesStore;
  readonly api: ApiClient;

  constructor(storage: SessionStorage) {
    this.session = new SessionStore(storage);
    this.api = this.session.api;
    this.admins = new AdminsStore(this.api);
    this.tags = new TagsStore(this.api);
    this.compositions = new CompositionsStore(this.api);
    this.audioClips = new AudioClipsStore(this.api);
    this.images = new ImagesStore(this.api);
    this.notes = new NotesStore(this.api);
  }
}
