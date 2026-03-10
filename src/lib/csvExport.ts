function escapeCsvField(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function toCsv<T>(rows: T[], columns: Array<{ key: keyof T; label: string; format?: (value: T[keyof T]) => string }>): string {
  const header = columns.map((column) => escapeCsvField(column.label)).join(',');

  const body = rows.map((row) => {
    return columns
      .map((column) => {
        const rawValue = row[column.key];
        const formatted = column.format ? column.format(rawValue) : String(rawValue ?? '');
        return escapeCsvField(formatted);
      })
      .join(',');
  });

  return [header, ...body].join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
