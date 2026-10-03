import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../../../shared/api/api-client.ts';
import { ApiError } from '../../../shared/api/api-error.ts';

export type CompositionImage = {
  id: string;
  fileUrl: string;
  order: number;
  createdAt: string;
};

export const MAX_IMAGE_FILES = 10;

export class ImagesStore {
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

  async uploadImages(
    compositionId: string,
    files: readonly File[],
  ): Promise<CompositionImage[]> {
    if (files.length === 0 || files.length > MAX_IMAGE_FILES) {
      throw new ApiError(null, [
        files.length === 0
          ? 'Выберите хотя бы один файл'
          : 'За один раз можно загрузить не больше 10 файлов',
      ]);
    }

    const body = new FormData();
    for (const file of files) {
      body.append('files', file);
    }

    const images = await this.api.requestForm<CompositionImage[]>(
      `/compositions/${compositionId}/images`,
      {
        method: 'POST',
        body,
      },
    );
    if (images === undefined) {
      throw new ApiError(null, ['Пустой ответ загрузки изображений']);
    }
    return images;
  }

  async listImages(compositionId: string): Promise<CompositionImage[]> {
    const images = await this.api.requestJson<CompositionImage[]>(
      `/compositions/${compositionId}/images`,
      {
        method: 'GET',
      },
    );
    if (images === undefined) {
      throw new ApiError(null, ['Пустой ответ списка изображений']);
    }
    return images;
  }

  async reorderImages(
    compositionId: string,
    imageIds: readonly string[],
  ): Promise<CompositionImage[]> {
    if (imageIds.length === 0) {
      throw new ApiError(null, ['Нужна хотя бы одна картинка']);
    }

    const images = await this.api.requestJson<CompositionImage[]>(
      `/compositions/${compositionId}/images/order`,
      {
        method: 'PATCH',
        body: { imageIds: [...imageIds] },
      },
    );
    if (images === undefined) {
      throw new ApiError(null, ['Пустой ответ порядка изображений']);
    }
    return images;
  }

  async removeImage(compositionId: string, imageId: string): Promise<void> {
    await this.api.requestJson(
      `/compositions/${compositionId}/images/${imageId}`,
      {
        method: 'DELETE',
      },
    );
  }
}
