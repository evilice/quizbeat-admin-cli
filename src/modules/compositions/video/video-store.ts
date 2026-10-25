import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../../../shared/api/api-client.ts';
import { ApiError } from '../../../shared/api/api-error.ts';

export type UploadVideoResult = {
  videoDurationSec: number;
};

export type VideoUrlResult = {
  url: string;
};

export class VideoStore {
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

  async save(
    compositionId: string,
    file: File,
    startSec: number,
    endSec: number,
  ): Promise<UploadVideoResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('startSec', secondsField(startSec));
    body.append('endSec', secondsField(endSec));
    const result = await this.api.requestForm<UploadVideoResult>(
      `/compositions/${compositionId}/video`,
      {
        method: 'POST',
        body,
      },
    );
    if (result === undefined) {
      throw new ApiError(null, ['Пустой ответ загрузки видео']);
    }
    return result;
  }

  async getUrl(compositionId: string): Promise<string | null> {
    try {
      const result = await this.api.requestJson<VideoUrlResult>(
        `/compositions/${compositionId}/video`,
        {
          method: 'GET',
        },
      );
      if (result === undefined) {
        throw new ApiError(null, ['Пустой ответ ссылки на видео']);
      }
      return result.url;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async remove(compositionId: string): Promise<void> {
    await this.api.requestJson(`/compositions/${compositionId}/video`, {
      method: 'DELETE',
    });
  }
}

/**
 * Multipart принимает только строки. `String(1e-7)` равен `1e-7`; сервер
 * такую запись разбирает (`Number('1e-7')`), но десятичная запись
 * не зависит от этого и читается в запросе. Защита на всякий случай: UI
 * округляет границы до 2 знаков, экспонента практически недостижима.
 * Округления здесь нет: в поле уходит то число, которое передали,
 * включая `0.1 + 0.2`.
 */
function secondsField(value: number): string {
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i.exec(text);
  if (match === null) {
    return text;
  }
  const sign = match[1] ?? '';
  const whole = match[2] ?? '';
  const fraction = match[3] ?? '';
  const digits = `${whole}${fraction}`;
  const point = whole.length + Number(match[4]);
  if (point <= 0) {
    return `${sign}0.${'0'.repeat(-point)}${digits}`;
  }
  if (point >= digits.length) {
    return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
  }
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}
