import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../api/api-client.ts';
import { ApiError } from '../api/api-error.ts';
import type { Tag } from './tags-store.ts';

export type CompositionStatus = 'DRAFT' | 'PUBLISHED';

export type Composition = {
  id: string;
  title: string;
  author: string;
  status: CompositionStatus;
  createdById: string;
  tags: Tag[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AudioClipDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type AudioClipStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type AudioClip = {
  id: string;
  difficulty: AudioClipDifficulty;
  durationSec: number;
  startTimeSec: number;
  status: AudioClipStatus;
  /** Есть только при `status === 'DONE'`; иначе поле отсутствует в JSON. */
  fileUrl?: string;
  createdAt: string;
};

export type CompositionImage = {
  id: string;
  fileUrl: string;
  order: number;
  createdAt: string;
};

export type NoteTranslation = {
  locale: 'ru' | 'en';
  text: string;
};

export type CompositionNote = {
  id: string;
  translations: NoteTranslation[];
  order: number;
  createdAt: string;
};

export type CompositionFull = Composition & {
  originalAudioUrl: string | null;
  originalAudioDurationSec: number | null;
  clips: AudioClip[];
  images: CompositionImage[];
  notes: CompositionNote[];
};

export type PaginatedCompositions = {
  items: Composition[];
  total: number;
  page: number;
  limit: number;
};

export type ListCompositionsParams = {
  search?: string;
  status?: CompositionStatus;
  /** Готовый массив uuid; в query уходит одной строкой через запятую. */
  tagIds?: string[];
  page?: number;
  limit?: number;
};

export type CreateCompositionInput = {
  title: string;
  author: string;
  status?: CompositionStatus;
  tagIds?: string[];
};

export type UpdateCompositionInput = {
  title?: string;
  author?: string;
  status?: CompositionStatus;
  tagIds?: string[];
};

export class CompositionsStore {
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

  async list(
    params: ListCompositionsParams = {},
  ): Promise<PaginatedCompositions> {
    const query = buildListQuery(params);
    const path = query === '' ? '/compositions' : `/compositions?${query}`;
    const page = await this.api.requestJson<PaginatedCompositions>(path, {
      method: 'GET',
    });
    if (page === undefined) {
      throw new ApiError(null, ['Пустой ответ списка композиций']);
    }
    return page;
  }

  async create(input: CreateCompositionInput): Promise<Composition> {
    const body: {
      title: string;
      author: string;
      status?: CompositionStatus;
      tagIds?: string[];
    } = {
      title: input.title,
      author: input.author,
    };
    if (input.status !== undefined) {
      body.status = input.status;
    }
    if (input.tagIds !== undefined) {
      body.tagIds = input.tagIds;
    }

    const composition = await this.api.requestJson<Composition>(
      '/compositions',
      {
        method: 'POST',
        body,
      },
    );
    if (composition === undefined) {
      throw new ApiError(null, ['Пустой ответ создания композиции']);
    }
    return composition;
  }

  async update(
    id: string,
    input: UpdateCompositionInput,
  ): Promise<Composition> {
    const body: {
      title?: string;
      author?: string;
      status?: CompositionStatus;
      tagIds?: string[];
    } = {};
    if (input.title !== undefined) {
      body.title = input.title;
    }
    if (input.author !== undefined) {
      body.author = input.author;
    }
    if (input.status !== undefined) {
      body.status = input.status;
    }
    if (input.tagIds !== undefined) {
      body.tagIds = input.tagIds;
    }

    const composition = await this.api.requestJson<Composition>(
      `/compositions/${id}`,
      {
        method: 'PATCH',
        body,
      },
    );
    if (composition === undefined) {
      throw new ApiError(null, ['Пустой ответ правки композиции']);
    }
    return composition;
  }

  async remove(id: string): Promise<Composition> {
    const composition = await this.api.requestJson<Composition>(
      `/compositions/${id}`,
      {
        method: 'DELETE',
      },
    );
    if (composition === undefined) {
      throw new ApiError(null, ['Пустой ответ удаления композиции']);
    }
    return composition;
  }

  async full(id: string): Promise<CompositionFull> {
    const composition = await this.api.requestJson<CompositionFull>(
      `/compositions/${id}/full`,
      {
        method: 'GET',
      },
    );
    if (composition === undefined) {
      throw new ApiError(null, ['Пустой ответ полной карточки композиции']);
    }
    return composition;
  }
}

function buildListQuery(params: ListCompositionsParams): string {
  const searchParams = new URLSearchParams();

  if (params.search !== undefined && params.search.trim() !== '') {
    searchParams.set('search', params.search);
  }
  if (params.status !== undefined) {
    searchParams.set('status', params.status);
  }
  if (params.tagIds !== undefined && params.tagIds.length > 0) {
    searchParams.set('tagIds', params.tagIds.join(','));
  }
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  return searchParams.toString();
}
