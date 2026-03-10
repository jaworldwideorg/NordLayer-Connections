import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { analyzeActivity } from './analyze';
import { parseConnectionsCsv, parseMembersCsv } from './parsers';
import type { ConnectionEvent, MemberRecord } from '../types/models';

async function loadFixture(relativePath: string): Promise<string> {
  const fixturePath = path.resolve(process.cwd(), relativePath);
  return readFile(fixturePath, 'utf8');
}

describe('CSV parsing and analysis', () => {
  test('parses sample connections and computes reference date with UTC logic', async () => {
    const connectionsCsv = await loadFixture('input/connections.csv');
    const parsed = parseConnectionsCsv(connectionsCsv);

    expect(parsed.rows.length).toBeGreaterThan(0);

    const result = analyzeActivity({
      connections: parsed.rows,
      days: 7,
      memberScope: 'active',
      warnings: parsed.warnings,
    });

    expect(result.referenceDateUtc.toISOString()).toBe('2026-03-10T08:45:33.000Z');
    expect(result.connectedWithinWindow.length).toBeGreaterThan(0);
    expect(result.stats.totalUniqueConnectedUsers).toBeGreaterThan(0);
  });

  test('supports member scope toggle and identifies not-connected members', async () => {
    const connectionsCsv = await loadFixture('input/connections.csv');
    const membersCsv = await loadFixture('input/members.csv');

    const parsedConnections = parseConnectionsCsv(connectionsCsv);
    const parsedMembers = parseMembersCsv(membersCsv);

    const activeOnly = analyzeActivity({
      connections: parsedConnections.rows,
      members: parsedMembers.rows,
      days: 30,
      memberScope: 'active',
      warnings: [...parsedConnections.warnings, ...parsedMembers.warnings],
    });

    const allMembers = analyzeActivity({
      connections: parsedConnections.rows,
      members: parsedMembers.rows,
      days: 30,
      memberScope: 'all',
      warnings: [...parsedConnections.warnings, ...parsedMembers.warnings],
    });

    expect(allMembers.stats.expectedMembers).toBeGreaterThanOrEqual(activeOnly.stats.expectedMembers);
    expect(allMembers.membersNotConnected.length).toBeGreaterThanOrEqual(activeOnly.membersNotConnected.length);
  });

  test('falls back to name identity when member email is malformed', () => {
    const membersCsv = [
      '"Organization ID","Member name",Email,Role,Teams,Status,"Creation date","Modified date","Exported date"',
      'jaworldwide,"Aryan Sanghrajka",4014bc4a659c45fe8607a392ae0d1620aryan.sanghrajka@jaworldwide.org,Member,"All Members",inactive,"2026-02-10 10:07:22","2026-02-18 16:29:19","2026-03-10 09:02:23"',
    ].join('\n');

    const parsed = parseMembersCsv(membersCsv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.identityKey).toBe('name:aryan sanghrajka');
  });

  test('adds unmatched-member warning when members cannot be mapped to uploaded connections', () => {
    const connections: ConnectionEvent[] = [
      {
        identityKey: 'email:alice@example.org',
        normalizedEmail: 'alice@example.org',
        normalizedName: 'alice',
        displayName: 'Alice',
        email: 'alice@example.org',
        connectedAt: new Date('2026-03-10T08:00:00.000Z'),
      },
    ];

    const members: MemberRecord[] = [
      {
        identityKey: 'email:alice@example.org',
        normalizedEmail: 'alice@example.org',
        normalizedName: 'alice',
        displayName: 'Alice',
        email: 'alice@example.org',
        status: 'active',
      },
      {
        identityKey: 'email:bob@example.org',
        normalizedEmail: 'bob@example.org',
        normalizedName: 'bob',
        displayName: 'Bob',
        email: 'bob@example.org',
        status: 'active',
      },
    ];

    const result = analyzeActivity({
      connections,
      members,
      days: 7,
      memberScope: 'active',
    });

    expect(result.stats.membersWithoutMatch).toBe(1);
    expect(result.warnings.some((warning) => warning.includes('could not be matched'))).toBe(true);
  });
});
