import type { MemberScope } from '../types/models';

const SETTINGS_KEY = 'nordlayer-analyzer:settings:v1';
const CONNECTIONS_KEY = 'nordlayer-analyzer:connections:v1';
const MEMBERS_KEY = 'nordlayer-analyzer:members:v1';

interface PersistedSettings {
  days: number;
  memberScope: MemberScope;
}

export interface PersistedCsv {
  fileName: string;
  text: string;
  savedAt: string;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function loadSettings(): PersistedSettings | null {
  if (!canUseStorage()) {
    return null;
  }

  const parsed = safeParse<PersistedSettings>(window.localStorage.getItem(SETTINGS_KEY));
  if (!parsed) {
    return null;
  }

  const days = Number(parsed.days);
  const memberScope = parsed.memberScope === 'all' ? 'all' : 'active';
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return null;
  }

  return { days, memberScope };
}

export function saveSettings(days: number, memberScope: MemberScope): void {
  if (!canUseStorage()) {
    return;
  }

  const payload: PersistedSettings = { days, memberScope };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

export function loadPersistedCsv(kind: 'connections' | 'members'): PersistedCsv | null {
  if (!canUseStorage()) {
    return null;
  }

  const key = kind === 'connections' ? CONNECTIONS_KEY : MEMBERS_KEY;
  const parsed = safeParse<PersistedCsv>(window.localStorage.getItem(key));
  if (!parsed || !parsed.fileName || !parsed.text) {
    return null;
  }

  return parsed;
}

export function savePersistedCsv(kind: 'connections' | 'members', fileName: string, text: string): void {
  if (!canUseStorage()) {
    return;
  }

  const key = kind === 'connections' ? CONNECTIONS_KEY : MEMBERS_KEY;
  const payload: PersistedCsv = {
    fileName,
    text,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(key, JSON.stringify(payload));
}

export function clearPersistedCsv(kind: 'connections' | 'members'): void {
  if (!canUseStorage()) {
    return;
  }

  const key = kind === 'connections' ? CONNECTIONS_KEY : MEMBERS_KEY;
  window.localStorage.removeItem(key);
}
