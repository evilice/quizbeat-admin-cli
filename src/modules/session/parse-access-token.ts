export type StaffRole = 'ADMIN' | 'SUPER_ADMIN';

export type ParsedAccessToken = {
  id: string;
  role: StaffRole;
};

const STAFF_ROLES = new Set<string>(['ADMIN', 'SUPER_ADMIN']);

export function parseAccessToken(token: string): ParsedAccessToken | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const payloadSegment = parts[1];
  if (payloadSegment === undefined || payloadSegment === '') {
    return null;
  }

  let jsonText: string;
  try {
    jsonText = decodeBase64UrlUtf8(payloadSegment);
  } catch {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  if (payload.type !== 'staff') {
    return null;
  }

  const sub = payload.sub;
  if (typeof sub !== 'string' || sub === '') {
    return null;
  }

  const role = payload.role;
  if (typeof role !== 'string' || !STAFF_ROLES.has(role)) {
    return null;
  }

  return { id: sub, role: role as StaffRole };
}

function decodeBase64UrlUtf8(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
