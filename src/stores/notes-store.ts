import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../api/api-client.ts';
import { ApiError } from '../api/api-error.ts';
import type { CompositionNote, NoteTranslation } from './compositions-store.ts';

export class NotesStore {
  readonly api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
    makeAutoObservable(
      this,
      {
        api: false,
      },
      { autoBind: true },
    );
  }

  async listNotes(compositionId: string): Promise<CompositionNote[]> {
    const notes = await this.api.requestJson<CompositionNote[]>(
      `/compositions/${compositionId}/notes`,
      {
        method: 'GET',
      },
    );
    if (notes === undefined) {
      throw new ApiError(null, ['Пустой ответ списка заметок']);
    }
    return notes;
  }

  async createNote(
    compositionId: string,
    translations: readonly NoteTranslation[],
  ): Promise<CompositionNote> {
    const note = await this.api.requestJson<CompositionNote>(
      `/compositions/${compositionId}/notes`,
      {
        method: 'POST',
        body: { translations: [...translations] },
      },
    );
    if (note === undefined) {
      throw new ApiError(null, ['Пустой ответ создания заметки']);
    }
    return note;
  }

  async updateNote(
    compositionId: string,
    noteId: string,
    translations: readonly NoteTranslation[],
  ): Promise<CompositionNote> {
    const note = await this.api.requestJson<CompositionNote>(
      `/compositions/${compositionId}/notes/${noteId}`,
      {
        method: 'PATCH',
        body: { translations: [...translations] },
      },
    );
    if (note === undefined) {
      throw new ApiError(null, ['Пустой ответ правки заметки']);
    }
    return note;
  }

  async reorderNotes(
    compositionId: string,
    noteIds: readonly string[],
  ): Promise<CompositionNote[]> {
    if (noteIds.length === 0) {
      throw new ApiError(null, ['Нужна хотя бы одна заметка']);
    }

    const notes = await this.api.requestJson<CompositionNote[]>(
      `/compositions/${compositionId}/notes/order`,
      {
        method: 'PATCH',
        body: { noteIds: [...noteIds] },
      },
    );
    if (notes === undefined) {
      throw new ApiError(null, ['Пустой ответ порядка заметок']);
    }
    return notes;
  }

  async removeNote(compositionId: string, noteId: string): Promise<void> {
    await this.api.requestJson(
      `/compositions/${compositionId}/notes/${noteId}`,
      {
        method: 'DELETE',
      },
    );
  }
}
