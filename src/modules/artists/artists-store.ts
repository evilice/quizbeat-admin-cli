import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../../shared/api/api-client.ts';
import { ApiError } from '../../shared/api/api-error.ts';

/** Исполнитель в ответе композиции и в значении поля формы. */
export type CompositionArtist = {
  id: string;
  name: string;
};

/** Исполнитель справочника `/artists`: та же пара плюс дата создания. */
export type Artist = CompositionArtist & {
  createdAt: string;
};

export type PaginatedArtists = {
  items: Artist[];
  total: number;
  page: number;
  limit: number;
};

export type ListArtistsParams = {
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateArtistInput = {
  name: string;
};

export type UpdateArtistInput = {
  name?: string;
};

export class ArtistsStore {
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

  async list(params: ListArtistsParams = {}): Promise<PaginatedArtists> {
    const query = buildListQuery(params);
    const path = query === '' ? '/artists' : `/artists?${query}`;
    const page = await this.api.requestJson<PaginatedArtists>(path, {
      method: 'GET',
    });
    if (page === undefined) {
      throw new ApiError(null, ['Пустой ответ списка исполнителей']);
    }
    return page;
  }

  async create(input: CreateArtistInput): Promise<Artist> {
    const artist = await this.api.requestJson<Artist>('/artists', {
      method: 'POST',
      body: {
        name: input.name,
      },
    });
    if (artist === undefined) {
      throw new ApiError(null, ['Пустой ответ создания исполнителя']);
    }
    return artist;
  }

  async update(id: string, input: UpdateArtistInput): Promise<Artist> {
    const body: { name?: string } = {};
    if (input.name !== undefined) {
      body.name = input.name;
    }

    const artist = await this.api.requestJson<Artist>(`/artists/${id}`, {
      method: 'PATCH',
      body,
    });
    if (artist === undefined) {
      throw new ApiError(null, ['Пустой ответ правки исполнителя']);
    }
    return artist;
  }

  async remove(id: string): Promise<void> {
    await this.api.requestJson(`/artists/${id}`, {
      method: 'DELETE',
    });
  }
}

const buildListQuery = (params: ListArtistsParams): string => {
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
};
