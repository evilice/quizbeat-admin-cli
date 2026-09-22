export class ApiError extends Error {
  /** `null`, если запрос не дошёл до сервера. Это не HTTP-статус. */
  readonly status: number | null;
  readonly messages: readonly string[];
  readonly details: Record<string, unknown> | undefined;

  constructor(
    status: number | null,
    messages: readonly string[],
    details?: Record<string, unknown>,
  ) {
    super(messages.join('\n'));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.details = details;
  }
}

export function errorFromResponse(status: number, raw: string): ApiError {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return new ApiError(status, []);
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      return new ApiError(status, [raw]);
    }
    return new ApiError(
      status,
      messagesFromBody(parsed.message),
      detailsFromBody(parsed.details),
    );
  } catch {
    return new ApiError(status, [raw]);
  }
}

function messagesFromBody(message: unknown): string[] {
  if (typeof message === 'string') {
    return [message];
  }
  if (Array.isArray(message)) {
    return message.map((item) =>
      typeof item === 'string' ? item : JSON.stringify(item),
    );
  }
  return [];
}

function detailsFromBody(
  details: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(details)) {
    return undefined;
  }
  return details;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
