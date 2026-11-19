import type { PoolClient } from 'pg';
import type { DatabaseClient } from '@/service/database/index.js';

export interface UpsertDeviceLogArchiveInput {
  deviceId: string;
  imei: string;
  yearMonth: string;
  s3Bucket: string;
  s3Key: string;
  archivedAt?: Date;
}

export interface DeviceLogArchiveRow {
  id: string;
  device_id: string;
  imei: string;
  year_month: string;
  s3_bucket: string;
  s3_key: string;
  archived_at: Date;
  created_at: Date;
}

/** Used by archive cron (pg PoolClient). API paths use DatabaseClient helpers below. */
export async function upsertDeviceLogArchive(
  db: PoolClient,
  input: UpsertDeviceLogArchiveInput,
): Promise<void> {
  const archivedAt = input.archivedAt ?? new Date();
  await db.query(
    `
    INSERT INTO device_log_archives (
      device_id, imei, year_month, s3_bucket, s3_key, archived_at
    ) VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz)
    ON CONFLICT (device_id, year_month) DO UPDATE SET
      imei = EXCLUDED.imei,
      s3_bucket = EXCLUDED.s3_bucket,
      s3_key = EXCLUDED.s3_key,
      archived_at = EXCLUDED.archived_at
    `,
    [
      input.deviceId,
      input.imei,
      input.yearMonth,
      input.s3Bucket,
      input.s3Key,
      archivedAt,
    ],
  );
}

export async function customerOwnsDevice(
  db: DatabaseClient,
  deviceId: string,
  customerId: string,
): Promise<boolean> {
  const row = await db.namedQueryOne<{ id: string }>(
    `SELECT id FROM devices WHERE id = $device_id::uuid AND user_id = $customer_id::uuid`,
    { device_id: deviceId, customer_id: customerId },
  );
  return Boolean(row);
}

export async function listDeviceLogArchivesForDevice(
  db: DatabaseClient,
  deviceId: string,
  customerId: string,
): Promise<DeviceLogArchiveRow[]> {
  return db.namedQueryAll<DeviceLogArchiveRow>(
    `
    SELECT
      a.id,
      a.device_id,
      a.imei,
      a.year_month,
      a.s3_bucket,
      a.s3_key,
      a.archived_at,
      a.created_at
    FROM device_log_archives a
    INNER JOIN devices d ON d.id = a.device_id
    WHERE a.device_id = $device_id::uuid
      AND d.user_id = $customer_id::uuid
    ORDER BY a.year_month DESC
    `,
    { device_id: deviceId, customer_id: customerId },
  );
}

export async function getDeviceLogArchiveForCustomer(
  db: DatabaseClient,
  deviceId: string,
  yearMonth: string,
  customerId: string,
): Promise<DeviceLogArchiveRow | null> {
  return db.namedQueryOne<DeviceLogArchiveRow>(
    `
    SELECT
      a.id,
      a.device_id,
      a.imei,
      a.year_month,
      a.s3_bucket,
      a.s3_key,
      a.archived_at,
      a.created_at
    FROM device_log_archives a
    INNER JOIN devices d ON d.id = a.device_id
    WHERE a.device_id = $device_id::uuid
      AND a.year_month = $year_month
      AND d.user_id = $customer_id::uuid
    `,
    { device_id: deviceId, year_month: yearMonth, customer_id: customerId },
  );
}

export async function deviceExists(
  db: DatabaseClient,
  deviceId: string,
): Promise<boolean> {
  const row = await db.namedQueryOne<{ id: string }>(
    `SELECT id FROM devices WHERE id = $device_id::uuid`,
    { device_id: deviceId },
  );
  return Boolean(row);
}

export async function getDeviceNameAndImei(
  db: DatabaseClient,
  deviceId: string,
): Promise<{ name: string | null; imei: string | null } | null> {
  return db.namedQueryOne<{ name: string | null; imei: string | null }>(
    `SELECT name, imei FROM devices WHERE id = $device_id::uuid`,
    { device_id: deviceId },
  );
}

export async function listDeviceLogArchivesForDeviceAdmin(
  db: DatabaseClient,
  deviceId: string,
): Promise<DeviceLogArchiveRow[]> {
  return db.namedQueryAll<DeviceLogArchiveRow>(
    `
    SELECT
      a.id,
      a.device_id,
      a.imei,
      a.year_month,
      a.s3_bucket,
      a.s3_key,
      a.archived_at,
      a.created_at
    FROM device_log_archives a
    WHERE a.device_id = $device_id::uuid
    ORDER BY a.year_month DESC
    `,
    { device_id: deviceId },
  );
}

export async function getDeviceLogArchiveForAdmin(
  db: DatabaseClient,
  deviceId: string,
  yearMonth: string,
): Promise<DeviceLogArchiveRow | null> {
  return db.namedQueryOne<DeviceLogArchiveRow>(
    `
    SELECT
      a.id,
      a.device_id,
      a.imei,
      a.year_month,
      a.s3_bucket,
      a.s3_key,
      a.archived_at,
      a.created_at
    FROM device_log_archives a
    WHERE a.device_id = $device_id::uuid
      AND a.year_month = $year_month
    `,
    { device_id: deviceId, year_month: yearMonth },
  );
}

export async function isDeviceLogMonthArchived(
  db: DatabaseClient,
  deviceId: string,
  yearMonth: string,
): Promise<boolean> {
  const row = await db.namedQueryOne<{ id: string }>(
    `
    SELECT id
    FROM device_log_archives
    WHERE device_id = $device_id::uuid
      AND year_month = $year_month
    `,
    { device_id: deviceId, year_month: yearMonth },
  );
  return Boolean(row);
}
