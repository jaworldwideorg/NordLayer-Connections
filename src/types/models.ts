export type MemberScope = 'active' | 'all';

export interface NormalizedUserIdentity {
  identityKey: string;
  normalizedEmail: string | null;
  normalizedName: string | null;
  displayName: string;
  email: string | null;
}

export interface ConnectionEvent extends NormalizedUserIdentity {
  connectedAt: Date;
}

export interface MemberRecord extends NormalizedUserIdentity {
  status: string | null;
}

export interface ConnectedUserResult extends NormalizedUserIdentity {
  lastConnectedAt: Date;
}

export interface MissingMemberResult extends MemberRecord {
  lastConnectedAt: Date | null;
}

export interface AnalysisStats {
  totalConnectionRows: number;
  totalUniqueConnectedUsers: number;
  connectedWithinDays: number;
  expectedMembers: number;
  membersMissingConnection: number;
  membersWithoutMatch: number;
}

export interface AnalysisResult {
  referenceDateUtc: Date;
  cutoffDateUtc: Date;
  connectedWithinWindow: ConnectedUserResult[];
  membersNotConnected: MissingMemberResult[];
  membersWithoutMatchDetails: MemberRecord[];
  stats: AnalysisStats;
  warnings: string[];
}

export interface ParseResult<T> {
  rows: T[];
  warnings: string[];
}
