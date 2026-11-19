/** Matches archiveDeviceLogsToS3 COPY columns. */
export const ARCHIVE_DEVICE_LOG_CSV_COLUMNS = [
  'device_id',
  'imei',
  'timestamp',
  'created_at',
  'data',
  'status',
] as const;

export type ArchiveDeviceLogCsvColumn = (typeof ARCHIVE_DEVICE_LOG_CSV_COLUMNS)[number];

export interface ArchiveFormatDeviceLogRow {
  device_id: string;
  imei: string | null;
  timestamp: Date | string;
  created_at: Date | string;
  data: Record<string, unknown> | null;
  status: string;
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function archiveDeviceLogCsvHeaderLine(): string {
  return `${ARCHIVE_DEVICE_LOG_CSV_COLUMNS.join(',')}\n`;
}

export function archiveDeviceLogRowToCsvLine(row: ArchiveFormatDeviceLogRow): string {
  return ARCHIVE_DEVICE_LOG_CSV_COLUMNS.map((col) => {
    if (col === 'data') {
      if (row.data === null || row.data === undefined) return '';
      return escapeCsvCell(JSON.stringify(row.data));
    }
    return escapeCsvCell(row[col]);
  }).join(',');
}
