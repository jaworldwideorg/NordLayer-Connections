import Papa from 'papaparse';
import { parseNordlayerUtcTimestamp } from './dates';
import { buildIdentity } from './identity';
import type { ConnectionEvent, MemberRecord, ParseResult } from '../types/models';

type CsvRow = Record<string, string | undefined>;

function parseCsvText(text: string): ParseResult<CsvRow> {
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    const warnings = parsed.errors.map((error) => `CSV parse warning on row ${error.row ?? '-'}: ${error.message}`);
    return { rows: parsed.data, warnings };
  }

  return { rows: parsed.data, warnings: [] };
}

export function parseConnectionsCsv(text: string): ParseResult<ConnectionEvent> {
  const base = parseCsvText(text);
  const warnings = [...base.warnings];
  const rows: ConnectionEvent[] = [];

  base.rows.forEach((row, index) => {
    const connectedAt = parseNordlayerUtcTimestamp(row.CONNECTED);
    if (!connectedAt) {
      warnings.push(`Skipped connections row ${index + 2}: invalid CONNECTED timestamp.`);
      return;
    }

    const identity = buildIdentity(row.NAME, row.EMAIL);
    if (!identity) {
      warnings.push(`Skipped connections row ${index + 2}: no usable email/name identity.`);
      return;
    }

    rows.push({
      ...identity,
      connectedAt,
    });
  });

  return { rows, warnings };
}

export function parseMembersCsv(text: string): ParseResult<MemberRecord> {
  const base = parseCsvText(text);
  const warnings = [...base.warnings];
  const rows: MemberRecord[] = [];

  base.rows.forEach((row, index) => {
    const identity = buildIdentity(row['Member name'], row.Email);
    if (!identity) {
      warnings.push(`Skipped members row ${index + 2}: no usable email/name identity.`);
      return;
    }

    rows.push({
      ...identity,
      status: row.Status?.trim().toLowerCase() ?? null,
    });
  });

  return { rows, warnings };
}
