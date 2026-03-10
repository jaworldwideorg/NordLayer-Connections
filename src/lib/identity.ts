import type { NormalizedUserIdentity } from '../types/models';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeEmail(email: string | undefined): string | null {
  if (!email) {
    return null;
  }

  const normalized = normalizeWhitespace(email).toLowerCase();
  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    return null;
  }

  // Some member exports include a 32-char token accidentally prefixed to the local-part.
  const [localPart] = normalized.split('@');
  if (localPart && /^[0-9a-f]{32}[a-z]/.test(localPart)) {
    return null;
  }

  return normalized;
}

export function normalizeName(name: string | undefined): string | null {
  if (!name) {
    return null;
  }

  const normalized = normalizeWhitespace(name).toLowerCase();
  return normalized || null;
}

export function buildIdentity(rawName: string | undefined, rawEmail: string | undefined): NormalizedUserIdentity | null {
  const normalizedEmail = normalizeEmail(rawEmail);
  const normalizedName = normalizeName(rawName);

  if (!normalizedEmail && !normalizedName) {
    return null;
  }

  const identityKey = normalizedEmail ? `email:${normalizedEmail}` : `name:${normalizedName}`;
  const fallbackDisplay = normalizedEmail ?? normalizedName ?? 'Unknown user';

  return {
    identityKey,
    normalizedEmail,
    normalizedName,
    displayName: normalizeWhitespace(rawName ?? '') || fallbackDisplay,
    email: normalizeWhitespace(rawEmail ?? '') || null,
  };
}
