import env from '@/config/env.js';
import type { DatabaseClient } from '@/service/database/index.js';
import type { ArchiveFormatDeviceLogRow } from '@/modules/device/utils/archiveDeviceLogCsv.js';

export const DEVICE_LOG_EXPORT_BATCH_SIZE = 500;

export interface DeviceLogDbExportMonth {
  year_month: string;
  row_count: number;
  last_log_at: Date | string;
}

function archiveTz(): string {
  return env.deviceLogArchive.tz || 'UTC';
}

export async function listDeviceLogDbExportMonths(
  db: DatabaseClient,
  deviceId: string,
): Promise<DeviceLogDbExportMonth[]> {
  const tz = archiveTz();

  return db.namedQueryAll<DeviceLogDbExportMonth>(
    `
    WITH by_month AS (
      SELECT
        to_char(date_trunc('month', dl.timestamp AT TIME ZONE $tz), 'YYYY-MM') AS year_month,
        COUNT(*)::int AS row_count,
        MAX(dl.timestamp) AS last_log_at
      FROM device_logs dl
      WHERE dl.device_id = $device_id::uuid
      GROUP BY 1
    )
    SELECT b.year_month, b.row_count, b.last_log_at
    FROM by_month b
    WHERE NOT EXISTS (
      SELECT 1
      FROM device_log_archives a
      WHERE a.device_id = $device_id::uuid
        AND a.year_month = b.year_month
    )
    ORDER BY b.year_month DESC
    `,
    { device_id: deviceId, tz },
  );
}

export async function* iterateDeviceLogMonthBatches(
  db: DatabaseClient,
  deviceId: string,
  yearMonth: string,
): AsyncGenerator<ArchiveFormatDeviceLogRow[]> {
  const tz = archiveTz();
  let offset = 0;

  while (true) {
    const rows = await db.namedQueryAll<ArchiveFormatDeviceLogRow>(
      `
      SELECT
        dl.device_id,
        d.imei,
        dl.timestamp,
        dl.created_at,
        dl.data,
        dl.status
      FROM device_logs dl
      INNER JOIN devices d ON d.id = dl.device_id
      WHERE dl.device_id = $device_id::uuid
        AND dl.timestamp >= (
          to_date($year_month || '-01', 'YYYY-MM-DD')::timestamp AT TIME ZONE $tz
        )
        AND dl.timestamp < (
          to_date($year_month || '-01', 'YYYY-MM-DD')::timestamp AT TIME ZONE $tz
        ) + interval '1 month'
      ORDER BY dl.timestamp, dl.created_at
      OFFSET $offset
      LIMIT $limit
      `,
      {
        device_id: deviceId,
        year_month: yearMonth,
        tz,
        offset,
        limit: DEVICE_LOG_EXPORT_BATCH_SIZE,
      },
    );

    if (rows.length === 0) break;

    yield rows;

    if (rows.length < DEVICE_LOG_EXPORT_BATCH_SIZE) break;
    offset += DEVICE_LOG_EXPORT_BATCH_SIZE;
  }
}

export function buildDbLogExportFileName(
  deviceName: string | null | undefined,
  imei: string | null | undefined,
  yearMonth: string,
): string {
  const safe = (raw: string | null | undefined, fallback: string) => {
    const s = (raw ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (s || fallback).slice(0, 80);
  };

  return `${safe(deviceName, 'device')}_${safe(imei, 'imei')}_${yearMonth}_db-logs.csv`;
}
