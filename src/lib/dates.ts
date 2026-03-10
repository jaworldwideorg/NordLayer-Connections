export function parseNordlayerUtcTimestamp(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const asIso = trimmed.replace(' UTC', 'Z').replace(' ', 'T');
  const parsed = new Date(asIso);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function formatUtcDateTime(value: Date | null): string {
  if (!value) {
    return 'Never';
  }

  return value.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}
