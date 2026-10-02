import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../api/api-client.ts';
import { ApiError } from '../api/api-error.ts';
import type { AudioClip, AudioClipDifficulty } from './compositions-store.ts';

export const AUDIO_CLIP_DURATIONS = [1, 2, 3, 5, 8, 13, 21] as const;

export type AudioClipDurationSec = (typeof AUDIO_CLIP_DURATIONS)[number];

export type AudioClipPoint = {
  startTimeSec: number;
  durationSec: AudioClipDurationSec;
  difficulty: AudioClipDifficulty;
};

export type UploadAudioResult = {
  originalAudioDurationSec: number;
};

export type AudioUrlResult = {
  url: string;
};

export class AudioClipsStore {
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

  async uploadAudio(
    compositionId: string,
    file: File,
  ): Promise<UploadAudioResult> {
    const body = new FormData();
    body.append('file', file);
    const result = await this.api.requestForm<UploadAudioResult>(
      `/compositions/${compositionId}/audio`,
      {
        method: 'POST',
        body,
      },
    );
    if (result === undefined) {
      throw new ApiError(null, ['Пустой ответ загрузки трека']);
    }
    return result;
  }

  async getAudioUrl(compositionId: string): Promise<AudioUrlResult> {
    const result = await this.api.requestJson<AudioUrlResult>(
      `/compositions/${compositionId}/audio`,
      {
        method: 'GET',
      },
    );
    if (result === undefined) {
      throw new ApiError(null, ['Пустой ответ ссылки на трек']);
    }
    return result;
  }

  async createClips(
    compositionId: string,
    points: readonly AudioClipPoint[],
  ): Promise<AudioClip[]> {
    if (points.length === 0) {
      throw new ApiError(null, ['Нужна хотя бы одна точка']);
    }

    const clips = await this.api.requestJson<AudioClip[]>(
      `/compositions/${compositionId}/clips`,
      {
        method: 'POST',
        body: {
          points: points.map((point) => ({
            startTimeSec: Math.trunc(point.startTimeSec),
            durationSec: point.durationSec,
            difficulty: point.difficulty,
          })),
        },
      },
    );
    if (clips === undefined) {
      throw new ApiError(null, ['Пустой ответ создания отрезков']);
    }
    return clips;
  }

  async listClips(compositionId: string): Promise<AudioClip[]> {
    const clips = await this.api.requestJson<AudioClip[]>(
      `/compositions/${compositionId}/clips`,
      {
        method: 'GET',
      },
    );
    if (clips === undefined) {
      throw new ApiError(null, ['Пустой ответ списка отрезков']);
    }
    return clips;
  }

  async removeClip(compositionId: string, clipId: string): Promise<void> {
    await this.api.requestJson(
      `/compositions/${compositionId}/clips/${clipId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async regenerateClip(
    compositionId: string,
    clipId: string,
  ): Promise<AudioClip> {
    const clip = await this.api.requestJson<AudioClip>(
      `/compositions/${compositionId}/clips/${clipId}/regenerate`,
      {
        method: 'POST',
      },
    );
    if (clip === undefined) {
      throw new ApiError(null, ['Пустой ответ перегенерации отрезка']);
    }
    return clip;
  }
}
