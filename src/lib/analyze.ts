import type {
  AnalysisResult,
  ConnectedUserResult,
  ConnectionEvent,
  MemberRecord,
  MemberScope,
  MissingMemberResult,
} from '../types/models';

interface AnalyzeInput {
  connections: ConnectionEvent[];
  members?: MemberRecord[];
  days: number;
  memberScope: MemberScope;
  warnings?: string[];
}

function pickPreferred<T extends { displayName: string; email: string | null }>(current: T, next: T): T {
  const currentScore = Number(Boolean(current.email)) + Number(Boolean(current.displayName));
  const nextScore = Number(Boolean(next.email)) + Number(Boolean(next.displayName));
  return nextScore >= currentScore ? next : current;
}

export function analyzeActivity(input: AnalyzeInput): AnalysisResult {
  const warnings = [...(input.warnings ?? [])];
  const referenceMs = Math.max(...input.connections.map((row) => row.connectedAt.getTime()));

  if (!Number.isFinite(referenceMs)) {
    throw new Error('No valid connection rows found.');
  }

  const referenceDateUtc = new Date(referenceMs);
  const cutoffDateUtc = new Date(referenceMs - input.days * 24 * 60 * 60 * 1000);

  const latestByIdentity = new Map<string, ConnectedUserResult>();

  for (const event of input.connections) {
    const existing = latestByIdentity.get(event.identityKey);
    if (!existing || existing.lastConnectedAt.getTime() < event.connectedAt.getTime()) {
      latestByIdentity.set(event.identityKey, {
        identityKey: event.identityKey,
        normalizedEmail: event.normalizedEmail,
        normalizedName: event.normalizedName,
        displayName: event.displayName,
        email: event.email,
        lastConnectedAt: event.connectedAt,
      });
      continue;
    }

    latestByIdentity.set(event.identityKey, pickPreferred(existing, {
      identityKey: event.identityKey,
      normalizedEmail: event.normalizedEmail,
      normalizedName: event.normalizedName,
      displayName: event.displayName,
      email: event.email,
      lastConnectedAt: existing.lastConnectedAt,
    }));
  }

  const connectedWithinWindow = [...latestByIdentity.values()]
    .filter((row) => row.lastConnectedAt.getTime() >= cutoffDateUtc.getTime())
    .sort((a, b) => b.lastConnectedAt.getTime() - a.lastConnectedAt.getTime());

  let membersNotConnected: MissingMemberResult[] = [];
  let expectedMembers = 0;
  let membersWithoutMatch = 0;

  if (input.members) {
    const expected = input.memberScope === 'active'
      ? input.members.filter((member) => (member.status ?? '') === 'active')
      : input.members;

    expectedMembers = expected.length;

    membersNotConnected = expected
      .map((member) => {
        const latest = latestByIdentity.get(member.identityKey);
        if (!latest) {
          membersWithoutMatch += 1;
        }
        return {
          ...member,
          lastConnectedAt: latest?.lastConnectedAt ?? null,
        };
      })
      .filter((member) => !member.lastConnectedAt || member.lastConnectedAt.getTime() < cutoffDateUtc.getTime())
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  if (input.members && expectedMembers === 0) {
    warnings.push('No members matched the current member scope.');
  }

  if (input.members && membersWithoutMatch > 0) {
    warnings.push(
      `${membersWithoutMatch} members from the current scope could not be matched to any user in the uploaded connections file.`,
    );
  }

  return {
    referenceDateUtc,
    cutoffDateUtc,
    connectedWithinWindow,
    membersNotConnected,
    warnings,
    stats: {
      totalConnectionRows: input.connections.length,
      totalUniqueConnectedUsers: latestByIdentity.size,
      connectedWithinDays: connectedWithinWindow.length,
      expectedMembers,
      membersMissingConnection: membersNotConnected.length,
      membersWithoutMatch,
    },
  };
}
