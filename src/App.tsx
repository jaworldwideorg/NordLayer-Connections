import { useEffect, useMemo, useState } from 'react';
import { analyzeActivity } from './lib/analyze';
import { downloadCsv, toCsv } from './lib/csvExport';
import { formatUtcDateTime } from './lib/dates';
import { readUploadedFile } from './lib/file';
import { parseConnectionsCsv, parseMembersCsv } from './lib/parsers';
import {
  clearPersistedCsv,
  loadPersistedCsv,
  loadSettings,
  savePersistedCsv,
  saveSettings,
} from './lib/storage';
import type {
  AnalysisResult,
  ConnectedUserResult,
  ConnectionEvent,
  MemberRecord,
  MemberScope,
  MissingMemberResult,
} from './types/models';

const DAY_PRESETS = [7, 14, 30, 60] as const;

type ConnectedSortKey = 'displayName' | 'email' | 'lastConnectedAt';
type MissingSortKey = 'displayName' | 'email' | 'status' | 'lastConnectedAt';
type SortDirection = 'asc' | 'desc';
type ResultTab = 'connected' | 'missing' | 'warnings';

const persistedSettings = loadSettings();

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function App() {
  const [connectionsFileName, setConnectionsFileName] = useState<string | null>(null);
  const [membersFileName, setMembersFileName] = useState<string | null>(null);
  const [connectionsCacheAt, setConnectionsCacheAt] = useState<string | null>(null);
  const [membersCacheAt, setMembersCacheAt] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionEvent[]>([]);
  const [members, setMembers] = useState<MemberRecord[] | null>(null);
  const [days, setDays] = useState<number>(persistedSettings?.days ?? 30);
  const [memberScope, setMemberScope] = useState<MemberScope>(persistedSettings?.memberScope ?? 'active');
  const [connectionsWarnings, setConnectionsWarnings] = useState<string[]>([]);
  const [membersWarnings, setMembersWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [connectedSearch, setConnectedSearch] = useState('');
  const [connectedSortKey, setConnectedSortKey] = useState<ConnectedSortKey>('lastConnectedAt');
  const [connectedSortDirection, setConnectedSortDirection] = useState<SortDirection>('desc');

  const [missingSearch, setMissingSearch] = useState('');
  const [missingSortKey, setMissingSortKey] = useState<MissingSortKey>('displayName');
  const [missingSortDirection, setMissingSortDirection] = useState<SortDirection>('asc');
  const [activeTab, setActiveTab] = useState<ResultTab>('connected');
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const cachedConnections = loadPersistedCsv('connections');
    if (cachedConnections) {
      const parsed = parseConnectionsCsv(cachedConnections.text);
      if (parsed.rows.length > 0) {
        setConnections(parsed.rows);
        setConnectionsFileName(cachedConnections.fileName);
        setConnectionsWarnings(parsed.warnings);
        setConnectionsCacheAt(cachedConnections.savedAt);
      }
    }

    const cachedMembers = loadPersistedCsv('members');
    if (cachedMembers) {
      const parsed = parseMembersCsv(cachedMembers.text);
      setMembers(parsed.rows);
      setMembersFileName(cachedMembers.fileName);
      setMembersWarnings(parsed.warnings);
      setMembersCacheAt(cachedMembers.savedAt);
    }
  }, []);

  useEffect(() => {
    saveSettings(days, memberScope);
  }, [days, memberScope]);

  const baseWarnings = useMemo(() => {
    return [...connectionsWarnings, ...membersWarnings];
  }, [connectionsWarnings, membersWarnings]);

  const analysis = useMemo<AnalysisResult | null>(() => {
    if (connections.length === 0) {
      return null;
    }

    return analyzeActivity({
      connections,
      members: members ?? undefined,
      days,
      memberScope,
      warnings: baseWarnings,
    });
  }, [baseWarnings, connections, days, memberScope, members]);

  const warningItems = useMemo(() => {
    if (!analysis) {
      return [];
    }

    let unmatchedAttached = false;
    const items = analysis.warnings.map((warning, index) => {
      const shouldAttachDetails = !unmatchedAttached && warning.includes('could not be matched')
        && analysis.membersWithoutMatchDetails.length > 0;

      if (shouldAttachDetails) {
        unmatchedAttached = true;
      }

      return {
        id: `warning-${index}`,
        message: warning,
        details: shouldAttachDetails ? analysis.membersWithoutMatchDetails : null,
      };
    });

    if (!unmatchedAttached && analysis.membersWithoutMatchDetails.length > 0) {
      items.unshift({
        id: 'unmatched-members',
        message: `${analysis.membersWithoutMatchDetails.length} members from the current scope could not be matched to any user in the uploaded connections file.`,
        details: analysis.membersWithoutMatchDetails,
      });
    }

    return items;
  }, [analysis]);

  useEffect(() => {
    if (activeTab === 'missing' && !members) {
      setActiveTab('connected');
      return;
    }

    if (activeTab === 'warnings' && warningItems.length === 0) {
      setActiveTab(members ? 'missing' : 'connected');
    }
  }, [activeTab, members, warningItems.length]);

  const visibleConnectedRows = useMemo<ConnectedUserResult[]>(() => {
    if (!analysis) {
      return [];
    }

    const filtered = analysis.connectedWithinWindow.filter((row) => {
      if (!connectedSearch.trim()) {
        return true;
      }

      const query = connectedSearch.trim();
      return includesText(row.displayName, query) || includesText(row.email ?? '', query);
    });

    return filtered.sort((left, right) => {
      let result = 0;

      if (connectedSortKey === 'lastConnectedAt') {
        result = left.lastConnectedAt.getTime() - right.lastConnectedAt.getTime();
      } else if (connectedSortKey === 'email') {
        result = compareText(left.email ?? '', right.email ?? '');
      } else {
        result = compareText(left.displayName, right.displayName);
      }

      return connectedSortDirection === 'asc' ? result : -result;
    });
  }, [analysis, connectedSearch, connectedSortDirection, connectedSortKey]);

  const visibleMissingRows = useMemo<MissingMemberResult[]>(() => {
    if (!analysis) {
      return [];
    }

    const filtered = analysis.membersNotConnected.filter((row) => {
      if (!missingSearch.trim()) {
        return true;
      }

      const query = missingSearch.trim();
      return (
        includesText(row.displayName, query)
        || includesText(row.email ?? '', query)
        || includesText(row.status ?? '', query)
      );
    });

    return filtered.sort((left, right) => {
      let result = 0;

      if (missingSortKey === 'lastConnectedAt') {
        result = (left.lastConnectedAt?.getTime() ?? -1) - (right.lastConnectedAt?.getTime() ?? -1);
      } else if (missingSortKey === 'email') {
        result = compareText(left.email ?? '', right.email ?? '');
      } else if (missingSortKey === 'status') {
        result = compareText(left.status ?? '', right.status ?? '');
      } else {
        result = compareText(left.displayName, right.displayName);
      }

      return missingSortDirection === 'asc' ? result : -result;
    });
  }, [analysis, missingSearch, missingSortDirection, missingSortKey]);

  async function handleConnectionsUpload(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    setIsLoadingConnections(true);
    setError(null);

    try {
      const text = await readUploadedFile(file);
      const parsed = parseConnectionsCsv(text);

      if (parsed.rows.length === 0) {
        throw new Error('No valid connection rows found in the uploaded CSV.');
      }

      setConnections(parsed.rows);
      setConnectionsFileName(file.name);
      setConnectionsWarnings(parsed.warnings);
      setConnectionsCacheAt(new Date().toISOString());
      savePersistedCsv('connections', file.name, text);
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        setError(uploadError.message);
      } else {
        setError('Failed to read connections file.');
      }
    } finally {
      setIsLoadingConnections(false);
    }
  }

  async function handleMembersUpload(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    setIsLoadingMembers(true);
    setError(null);

    try {
      const text = await readUploadedFile(file);
      const parsed = parseMembersCsv(text);
      setMembers(parsed.rows);
      setMembersFileName(file.name);
      setMembersWarnings(parsed.warnings);
      setMembersCacheAt(new Date().toISOString());
      savePersistedCsv('members', file.name, text);
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        setError(uploadError.message);
      } else {
        setError('Failed to read members file.');
      }
    } finally {
      setIsLoadingMembers(false);
    }
  }

  function clearConnectionsCache(): void {
    clearPersistedCsv('connections');
    setConnections([]);
    setConnectionsWarnings([]);
    setConnectionsFileName(null);
    setConnectionsCacheAt(null);
  }

  function clearMembersCache(): void {
    clearPersistedCsv('members');
    setMembers(null);
    setMembersWarnings([]);
    setMembersFileName(null);
    setMembersCacheAt(null);
  }

  function exportConnected(rows: ConnectedUserResult[]): void {
    const csv = toCsv(rows, [
      { key: 'displayName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'lastConnectedAt', label: 'Last Connected (UTC)', format: (value) => formatUtcDateTime(value as Date) },
    ]);
    downloadCsv(csv, `connected-within-${days}-days.csv`);
  }

  function exportMissing(rows: MissingMemberResult[]): void {
    const csv = toCsv(rows, [
      { key: 'displayName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'lastConnectedAt', label: 'Last Connected (UTC)', format: (value) => formatUtcDateTime(value as Date | null) },
    ]);
    downloadCsv(csv, `members-not-connected-${days}-days.csv`);
  }

  return (
    <main className="app-shell compact-mode">
      <header className="hero">
        <h1>NordLayer Connections Analyzer</h1>
        <p>
          Upload a NordLayer connections CSV and find unique users connected in the last <strong>X</strong> days.
          Optionally upload members CSV to identify members missing recent connections.
        </p>
      </header>

      <section className="controls-grid" aria-label="Upload controls">
        <article className="panel">
          <h2>Connections CSV (required)</h2>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              void handleConnectionsUpload(event.target.files?.[0] ?? null);
            }}
          />
          <p className="hint">Expected fields: NAME, EMAIL, CONNECTED</p>
          {connectionsFileName && <p className="ok">Loaded: {connectionsFileName}</p>}
          {connectionsCacheAt && <p className="hint">Cached: {new Date(connectionsCacheAt).toLocaleString()}</p>}
          {connections.length > 0 && (
            <button type="button" className="secondary-button" onClick={clearConnectionsCache}>
              Clear cached connections
            </button>
          )}
          {isLoadingConnections && <p className="hint">Parsing connections file...</p>}
        </article>

        <article className="panel">
          <h2>Members CSV (optional)</h2>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              void handleMembersUpload(event.target.files?.[0] ?? null);
            }}
          />
          <p className="hint">Expected fields: Member name, Email, Status</p>
          {membersFileName && <p className="ok">Loaded: {membersFileName}</p>}
          {membersCacheAt && <p className="hint">Cached: {new Date(membersCacheAt).toLocaleString()}</p>}
          {members && (
            <button type="button" className="secondary-button" onClick={clearMembersCache}>
              Clear cached members
            </button>
          )}
          {isLoadingMembers && <p className="hint">Parsing members file...</p>}
        </article>

        <article className="panel">
          <h2>Window</h2>
          <label htmlFor="days">Days to look back</label>
          <input
            id="days"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))}
          />
          <div className="preset-row" role="group" aria-label="Day presets">
            {DAY_PRESETS.map((preset) => (
              <button key={preset} type="button" onClick={() => setDays(preset)}>
                {preset}d
              </button>
            ))}
          </div>
          {members && (
            <div className="scope-row" role="radiogroup" aria-label="Member scope">
              <label>
                <input
                  type="radio"
                  name="memberScope"
                  value="active"
                  checked={memberScope === 'active'}
                  onChange={() => setMemberScope('active')}
                />
                Active only
              </label>
              <label>
                <input
                  type="radio"
                  name="memberScope"
                  value="all"
                  checked={memberScope === 'all'}
                  onChange={() => setMemberScope('all')}
                />
                All members
              </label>
            </div>
          )}
        </article>
      </section>

      {error && <p className="error">{error}</p>}

      {analysis && (
        <>
          <section className="stats-grid" aria-label="Summary statistics">
            <article className="stat-card">
              <h3>Reference Date</h3>
              <p>{formatUtcDateTime(analysis.referenceDateUtc)}</p>
            </article>
            <article className="stat-card">
              <h3>Unique Connected Users</h3>
              <p>{analysis.stats.totalUniqueConnectedUsers}</p>
            </article>
            <article className="stat-card">
              <h3>Connected in Last {days} Days</h3>
              <p>{analysis.stats.connectedWithinDays}</p>
            </article>
            {members && (
              <>
                <article className="stat-card">
                  <h3>Expected Members</h3>
                  <p>{analysis.stats.expectedMembers}</p>
                </article>
                <article className="stat-card">
                  <h3>Members Not Connected</h3>
                  <p>{analysis.stats.membersMissingConnection}</p>
                </article>
                <article className="stat-card">
                  <h3>Members Without Match</h3>
                  <p>{analysis.stats.membersWithoutMatch}</p>
                </article>
              </>
            )}
          </section>

          <section className="tabs-panel panel" aria-label="Result tabs">
            <div className="tabs-header" role="tablist" aria-label="Analysis result sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'connected'}
                className={`tab-button ${activeTab === 'connected' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('connected')}
              >
                Users Connected ({visibleConnectedRows.length})
              </button>
              {members && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'missing'}
                  className={`tab-button ${activeTab === 'missing' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('missing')}
                >
                  Members Not Connected ({visibleMissingRows.length})
                </button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'warnings'}
                className={`tab-button ${activeTab === 'warnings' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('warnings')}
              >
                Warnings ({warningItems.length})
              </button>
            </div>
          </section>

          {activeTab === 'connected' && (
            <section className="panel results-panel" aria-label="Connected users">
            <div className="section-head">
              <h2>Users Connected in Last {days} Days</h2>
              <button type="button" onClick={() => exportConnected(visibleConnectedRows)}>
                Export CSV
              </button>
            </div>
            <div className="table-controls">
              <label>
                Search
                <input
                  type="search"
                  value={connectedSearch}
                  onChange={(event) => setConnectedSearch(event.target.value)}
                  placeholder="Name or email"
                />
              </label>
              <label>
                Sort by
                <select
                  value={connectedSortKey}
                  onChange={(event) => setConnectedSortKey(event.target.value as ConnectedSortKey)}
                >
                  <option value="lastConnectedAt">Last Connected</option>
                  <option value="displayName">Name</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConnectedSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                {connectedSortDirection === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Last Connected (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleConnectedRows.map((row) => (
                    <tr key={row.identityKey}>
                      <td>{row.displayName}</td>
                      <td>{row.email ?? '-'}</td>
                      <td>{formatUtcDateTime(row.lastConnectedAt)}</td>
                    </tr>
                  ))}
                  {visibleConnectedRows.length === 0 && (
                    <tr>
                      <td colSpan={3}>No users match the current filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </section>
          )}

          {members && activeTab === 'missing' && (
            <section className="panel results-panel" aria-label="Members not connected">
              <div className="section-head">
                <h2>Members Not Connected in Last {days} Days</h2>
                <button type="button" onClick={() => exportMissing(visibleMissingRows)}>
                  Export CSV
                </button>
              </div>
              <div className="table-controls">
                <label>
                  Search
                  <input
                    type="search"
                    value={missingSearch}
                    onChange={(event) => setMissingSearch(event.target.value)}
                    placeholder="Name, email, or status"
                  />
                </label>
                <label>
                  Sort by
                  <select value={missingSortKey} onChange={(event) => setMissingSortKey(event.target.value as MissingSortKey)}>
                    <option value="displayName">Name</option>
                    <option value="email">Email</option>
                    <option value="status">Status</option>
                    <option value="lastConnectedAt">Last Connected</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setMissingSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                >
                  {missingSortDirection === 'asc' ? 'Ascending' : 'Descending'}
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Last Connected (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMissingRows.map((row) => (
                      <tr key={row.identityKey}>
                        <td>{row.displayName}</td>
                        <td>{row.email ?? '-'}</td>
                        <td>{row.status ?? '-'}</td>
                        <td>{formatUtcDateTime(row.lastConnectedAt)}</td>
                      </tr>
                    ))}
                    {visibleMissingRows.length === 0 && (
                      <tr>
                        <td colSpan={4}>No members match the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'warnings' && (
            <section className="panel warnings" aria-label="Warnings">
              <h2>Warnings ({warningItems.length})</h2>
              {warningItems.length === 0 && <p className="hint">No warnings for the currently loaded files.</p>}
              {warningItems.map((warning) => (
                <article key={warning.id} className="warning-item">
                  <div className="warning-line">
                    <p>{warning.message}</p>
                    {warning.details && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setExpandedWarnings((previous) => ({
                            ...previous,
                            [warning.id]: !previous[warning.id],
                          }));
                        }}
                      >
                        {expandedWarnings[warning.id] ? 'Hide Members' : `Show Members (${warning.details.length})`}
                      </button>
                    )}
                  </div>
                  {warning.details && expandedWarnings[warning.id] && (
                    <div className="table-wrap warning-details">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warning.details.map((member) => (
                            <tr key={member.identityKey}>
                              <td>{member.displayName}</td>
                              <td>{member.email ?? '-'}</td>
                              <td>{member.status ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default App;
