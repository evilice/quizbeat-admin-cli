import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../../shared/api/api-client.ts';
import { ApiError, messagesFromError } from '../../shared/api/api-error.ts';
import {
  STORAGE_OUTCOME_UNKNOWN_MESSAGE,
  STORAGE_PREVIEW_STALE_MESSAGE,
} from './storage-display.ts';

/** Предпросмотр старше этого срока перед удалением проверяется заново. */
export const PREVIEW_MAX_AGE_MS = 5 * 60 * 1000;

const KNOWN_REFUSALS: ReadonlySet<number> = new Set([
  400, 401, 403, 409, 422, 429,
]);

export type StorageSweepCount = {
  count: number;
  bytes: number;
};

export type StorageSweepPrefix = StorageSweepCount & {
  prefix: string;
};

export type StorageSweepResult = {
  applied: boolean;
  byPrefix: StorageSweepPrefix[];
  total: StorageSweepCount;
  failed: number;
  failedBytes: number;
};

export class StorageStore {
  readonly api: ApiClient;

  /** Предпросмотр (`apply: false`). После итога сбрасывается. */
  previewResult: StorageSweepResult | null = null;

  /** Итог удаления (`apply: true`), не числа предпросмотра. */
  outcome: StorageSweepResult | null = null;

  pending = false;

  messages: readonly string[] = [];

  private previewAt = 0;

  private previewClock = 0;

  /** Идущий запрос — удаление (`apply: true`), а не проверка. */
  private sweeping = false;

  /** Сессия оборвала удаление: сообщение переживает `reset()` до новой проверки. */
  private outcomeUnknown = false;

  /** Растёт при `discard()`: ответ запроса прошлой сессии не пишется. */
  private generation = 0;

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

  async preview(): Promise<void> {
    if (this.pending) {
      return;
    }
    const generation = this.beginRequest();
    this.previewResult = null;
    try {
      const result = await this.post(false);
      if (generation === this.generation) {
        this.applyPreview(result);
      }
    } catch (error) {
      if (generation === this.generation) {
        this.applyError(error);
      }
    }
  }

  async sweep(): Promise<void> {
    if (this.pending || !this.requireFreshPreview()) {
      return;
    }
    const generation = this.beginRequest();
    this.sweeping = true;
    try {
      const result = await this.post(true);
      if (generation === this.generation) {
        this.applySweep(result);
      }
    } catch (error) {
      if (generation === this.generation) {
        this.applySweepError(error);
      }
    }
  }

  /**
   * Сервер пересчитывает кандидатов при каждом удалении, поэтому согласие
   * действует только на свежий предпросмотр. Устаревший сбрасывается.
   */
  requireFreshPreview(): boolean {
    if (this.previewResult === null) {
      return false;
    }
    // Две шкалы: монотонная не идёт во сне, настенная уходит при смене часов.
    const age = Math.max(
      Date.now() - this.previewAt,
      performance.now() - this.previewClock,
    );
    if (age > PREVIEW_MAX_AGE_MS) {
      this.previewResult = null;
      this.messages = [STORAGE_PREVIEW_STALE_MESSAGE];
      return false;
    }
    return true;
  }

  clearMessages(): void {
    this.messages = [];
  }

  /**
   * Уход со страницы. Идущее удаление не трогается вовсе: его ответ придёт
   * в полный контекст (предпросмотр, диалог). Иначе предпросмотр и сообщения
   * сбрасываются, идущая проверка отбрасывается. Готовый итог удаления
   * остаётся до следующего запроса: предупреждение о неудалённых файлах не
   * должно пропасть при навигации.
   */
  reset(): void {
    if (this.pending && this.sweeping) {
      return;
    }
    if (this.pending) {
      this.generation += 1;
      this.pending = false;
    }
    this.previewResult = null;
    if (!this.outcomeUnknown) {
      this.messages = [];
    }
  }

  /**
   * Конец сессии: всё состояние и ответ идущего запроса отбрасываются.
   * Если шло удаление, его исход неизвестен и следующий экран об этом скажет.
   */
  discard(): void {
    const interrupted = this.pending && this.sweeping;
    this.generation += 1;
    this.pending = false;
    this.sweeping = false;
    this.previewResult = null;
    this.outcome = null;
    this.outcomeUnknown = interrupted;
    this.messages = interrupted ? [STORAGE_OUTCOME_UNKNOWN_MESSAGE] : [];
  }

  private beginRequest(): number {
    this.sweeping = false;
    this.outcomeUnknown = false;
    this.outcome = null;
    this.pending = true;
    this.messages = [];
    return this.generation;
  }

  private applyPreview(result: StorageSweepResult): void {
    this.previewResult = result;
    this.previewAt = Date.now();
    this.previewClock = performance.now();
    this.pending = false;
  }

  private applySweep(result: StorageSweepResult): void {
    this.outcome = result;
    this.previewResult = null;
    this.pending = false;
  }

  private applyError(error: unknown): void {
    this.messages = messagesFromError(error);
    this.pending = false;
  }

  /**
   * Ошибка на `apply: true`. Определённый отказ — только статусы, при которых
   * сервер удаление не начинал (`KNOWN_REFUSALS`). Обрыв, нечитаемый `2xx`,
   * `5xx`, `408` и прочее — исход неизвестен: файлы могли быть удалены,
   * предпросмотр тогда недействителен.
   */
  private applySweepError(error: unknown): void {
    const unknown =
      error instanceof ApiError
        ? error.status === null || !KNOWN_REFUSALS.has(error.status)
        : true;
    this.messages = unknown
      ? [...messagesFromError(error), STORAGE_OUTCOME_UNKNOWN_MESSAGE]
      : messagesFromError(error);
    if (unknown) {
      this.previewResult = null;
      this.outcomeUnknown = true;
    }
    this.pending = false;
  }

  /**
   * Общий клиент без своего таймаута: запрос синхронный и может занять
   * секунды. Короткий обрыв здесь не ставится. Сам стор запрос не повторяет;
   * повтор делает только общий клиент после `401` и refresh — сервер в этом
   * случае отказал до выполнения, удаления не было.
   */
  private async post(apply: boolean): Promise<StorageSweepResult> {
    const result = await this.api.requestJson<StorageSweepResult>(
      '/storage/sweep',
      {
        method: 'POST',
        body: { apply },
      },
    );
    if (!isSweepResult(result) || result.applied !== apply) {
      throw new ApiError(null, ['Неожиданный ответ очистки хранилища']);
    }
    return result;
  }
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isCount = (value: unknown): value is StorageSweepCount =>
  typeof value === 'object' &&
  value !== null &&
  isNonNegativeInteger((value as StorageSweepCount).count) &&
  isNonNegativeInteger((value as StorageSweepCount).bytes);

const isSweepResult = (value: unknown): value is StorageSweepResult => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const result = value as Partial<StorageSweepResult>;
  return (
    Array.isArray(result.byPrefix) &&
    result.byPrefix.every(
      (row) =>
        isCount(row) &&
        typeof (row as { prefix?: unknown }).prefix === 'string',
    ) &&
    typeof result.applied === 'boolean' &&
    isCount(result.total) &&
    isNonNegativeInteger(result.failed) &&
    isNonNegativeInteger(result.failedBytes)
  );
};
