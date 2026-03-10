import { describe, expect, test } from 'vitest';
import { parseConnectionsCsv } from './parsers';

describe('parseConnectionsCsv', () => {
  test('skips rows with invalid CONNECTED values', () => {
    const csv = ['"NAME","EMAIL","CONNECTED"', '"User A","user.a@example.org","bad-date"'].join('\n');

    const parsed = parseConnectionsCsv(csv);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.warnings[0]).toContain('invalid CONNECTED timestamp');
  });
});
