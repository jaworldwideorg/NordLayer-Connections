import { beforeEach, describe, expect, test } from 'vitest';
import {
  clearPersistedCsv,
  loadPersistedCsv,
  loadSettings,
  savePersistedCsv,
  saveSettings,
} from './storage';

describe('storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('persists and reloads settings', () => {
    saveSettings(14, 'all');
    const loaded = loadSettings();

    expect(loaded).toEqual({ days: 14, memberScope: 'all' });
  });

  test('persists and clears csv payload', () => {
    savePersistedCsv('members', 'members.csv', 'a,b\n1,2');

    const loaded = loadPersistedCsv('members');
    expect(loaded?.fileName).toBe('members.csv');
    expect(loaded?.text).toBe('a,b\n1,2');

    clearPersistedCsv('members');
    expect(loadPersistedCsv('members')).toBeNull();
  });
});
