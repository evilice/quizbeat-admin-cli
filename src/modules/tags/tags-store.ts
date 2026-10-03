import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../../shared/api/api-client.ts';
import { ApiError } from '../../shared/api/api-error.ts';

export type TagLocale = 'ru' | 'en';

export type TagTranslation = {
  locale: TagLocale;
  name: string;
};

export type Tag = {
  id: string;
  code: string;
  translations: TagTranslation[];
  createdAt: string;
};

export type PaginatedTags = {
  items: Tag[];
  total: number;
  page: number;
  limit: number;
};

export type ListTagsParams = {
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateTagInput = {
  code: string;
  translations: TagTranslation[];
};

export type UpdateTagInput = {
  code?: string;
  translations?: TagTranslation[];
};

export class TagsStore {
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

  async list(params: ListTagsParams = {}): Promise<PaginatedTags> {
    const query = buildListQuery(params);
    const path = query === '' ? '/tags' : `/tags?${query}`;
    const page = await this.api.requestJson<PaginatedTags>(path, {
      method: 'GET',
    });
    if (page === undefined) {
      throw new ApiError(null, ['Пустой ответ списка тегов']);
    }
    return page;
  }

  async create(input: CreateTagInput): Promise<Tag> {
    const tag = await this.api.requestJson<Tag>('/tags', {
      method: 'POST',
      body: {
        code: input.code,
        translations: input.translations,
      },
    });
    if (tag === undefined) {
      throw new ApiError(null, ['Пустой ответ создания тега']);
    }
    return tag;
  }

  async update(id: string, input: UpdateTagInput): Promise<Tag> {
    const body: { code?: string; translations?: TagTranslation[] } = {};
    if (input.code !== undefined) {
      body.code = input.code;
    }
    if (input.translations !== undefined) {
      body.translations = input.translations;
    }

    const tag = await this.api.requestJson<Tag>(`/tags/${id}`, {
      method: 'PATCH',
      body,
    });
    if (tag === undefined) {
      throw new ApiError(null, ['Пустой ответ правки тега']);
    }
    return tag;
  }

  async remove(id: string): Promise<void> {
    await this.api.requestJson(`/tags/${id}`, {
      method: 'DELETE',
    });
  }
}

function buildListQuery(params: ListTagsParams): string {
  const searchParams = new URLSearchParams();

  if (params.search !== undefined && params.search.trim() !== '') {
    searchParams.set('search', params.search);
  }
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  return searchParams.toString();
}
