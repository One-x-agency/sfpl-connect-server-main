/**
 * Archive device_logs outside the retention window to S3, then delete from Postgres.
 * CSV export uses PostgreSQL COPY TO STDOUT (pg-copy-streams).
 *
 * S3 path: {prefix}/{imei}-{device-name}/{YYYY-MM}_{imei}.csv.zip
 *
 * Run: npm run archive-device-logs
 * Cron: every ~15 days (1st & 16th 04:00 Asia/Kolkata) — scheduled in src/etc/cron/index.ts
 *
 * Safety:
 * - Delete only after S3 object exists (HeadObject).
 * - Upload retries; idempotent skip if key already exists (unless forceReexport).
 * - Batched DELETE to reduce table locks.
 * - Re-run after partial failure is safe.
 */
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { to as copyTo } from 'pg-copy-streams';
import type { PoolClient } from 'pg';
import { Pool, type PoolConfig } from 'pg';
import env from '@/config/env.js';
import { s3 } from '@/service/aws/index.js';
import { upsertDeviceLogArchive } from '@/modules/device/services/deviceLogArchive.service.js';
import { withCronTask } from '@/core/cron/withCronTask.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '../../../..');
const LOCK_DIR = path.join(SERVER_ROOT, 'tmp/archive-device-logs.lock');
const LOCK_PID_FILE = path.join(LOCK_DIR, 'pid');

const SLICE_WHERE_SQL = `
  device_id = $1::uuid
  AND "timestamp" >= (to_date($2::text || '-01', 'YYYY-MM-DD')::timestamp AT TIME ZONE $3::text)
  AND "timestamp" < (to_date($2::text || '-01', 'YYYY-MM-DD')::timestamp AT TIME ZONE $3::text) + interval '1 month'
  AND ("timestamp" < $4::timestamptz OR "timestamp" >= $5::timestamptz)`;

interface RetentionWindow {
  start: string;
  end: string;
}

interface ArchiveSlot {
  deviceId: string;
  imei: string;
  deviceName: string;
  yearMonth: string;
}

function log(message: string): void {
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  console.log(`[${ts}] ${message}`);
}

function assertTzSafe(tz: string): void {
  if (!/^[A-Za-z0-9_/+-]+$/.test(tz)) {
    throw new Error('DEVICE_LOG_ARCHIVE_TZ must be a safe IANA timezone identifier');
  }
}

function assertUuid(id: string): void {
  // Accept any RFC-4122-shaped UUID (incl. v7 from devices.id); hex + hyphens only for COPY SQL safety.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error(`invalid device id: ${id}`);
  }
}

function assertYearMonth(ym: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) {
    throw new Error(`invalid year-month: ${ym}`);
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildSliceCopySql(
  deviceId: string,
  yearMonth: string,
  tz: string,
  window: RetentionWindow,
): string {
  assertUuid(deviceId);
  assertYearMonth(yearMonth);
  assertTzSafe(tz);

  const monthStart = `(to_date(${sqlLiteral(`${yearMonth}-01`)}, 'YYYY-MM-DD')::timestamp AT TIME ZONE ${sqlLiteral(tz)})`;

  return `
COPY (
  SELECT device_id, imei, "timestamp", created_at, data, status
  FROM device_logs
  WHERE device_id = ${sqlLiteral(deviceId)}::uuid
    AND "timestamp" >= ${monthStart}
    AND "timestamp" < ${monthStart} + interval '1 month'
    AND ("timestamp" < ${sqlLiteral(window.start)}::timestamptz
      OR "timestamp" >= ${sqlLiteral(window.end)}::timestamptz)
) TO STDOUT WITH (FORMAT csv, HEADER true)`.trim();
}

function safeSlug(raw: string | null | undefined, maxLen: number): string {
  const s = (raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.slice(0, maxLen);
}

function s3FolderForDevice(imei: string, deviceName: string): string {
  const safeImei = safeSlug(imei, 32) || 'unknown-imei';
  const safeName = safeSlug(deviceName, 100);
  if (!safeName) return safeImei;
  return `${safeImei}-${safeName}`.slice(0, 200);
}

type S3ArchiveKeys = { zip: string; legacyGzip: string; legacyCsv: string };

function buildS3ArchiveKeys(
  prefix: string,
  folder: string,
  yearMonth: string,
  imeiFile: string,
): S3ArchiveKeys {
  const base = `${prefix}/${folder}/${yearMonth}_${imeiFile}`;
  return { zip: `${base}.csv.zip`, legacyGzip: `${base}.csv.gz`, legacyCsv: `${base}.csv` };
}

async function zipCsvFile(srcPath: string, destPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(destPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.file(srcPath, { name: path.basename(srcPath) });
    archive.finalize();
  });
}

async function s3ArchiveAlreadyStored(bucket: string, keys: S3ArchiveKeys): Promise<boolean> {
  if (await s3ObjectExists(bucket, keys.zip)) return true;
  if (await s3ObjectExists(bucket, keys.legacyGzip)) return true;
  if (await s3ObjectExists(bucket, keys.legacyCsv)) return true;
  return false;
}

async function resolveStoredS3Key(bucket: string, keys: S3ArchiveKeys): Promise<string> {
  if (await s3ObjectExists(bucket, keys.zip)) return keys.zip;
  if (await s3ObjectExists(bucket, keys.legacyGzip)) return keys.legacyGzip;
  if (await s3ObjectExists(bucket, keys.legacyCsv)) return keys.legacyCsv;
  return keys.zip;
}

async function recordArchive(
  client: PoolClient,
  slot: ArchiveSlot,
  cfg: ReturnType<typeof validateConfig>,
  s3Key: string,
): Promise<void> {
  await upsertDeviceLogArchive(client, {
    deviceId: slot.deviceId,
    imei: slot.imei,
    yearMonth: slot.yearMonth,
    s3Bucket: cfg.s3Bucket,
    s3Key,
  });
}

function createPool(): Pool {
  const config: PoolConfig = {
    user: env.database.user,
    password: env.database.password,
    host: env.database.host,
    database: env.database.database,
    port: Number(env.database.port),
    max: 2,
    statement_timeout: 0,
    query_timeout: 0,
  };
  if (env.database.sslMode) {
    config.ssl = { rejectUnauthorized: false };
  }
  return new Pool(config);
}

async function setSessionTz(client: PoolClient, tz: string): Promise<void> {
  await client.query(`SET TIME ZONE '${tz}'`);
}

function validateConfig(): typeof env.deviceLogArchive {
  const cfg = env.deviceLogArchive;

  if (!cfg.s3Bucket) {
    throw new Error('DEVICE_LOG_ARCHIVE_S3_BUCKET is required');
  }
  if (!env.aws.accessKeyId || !env.aws.secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
  }
  if (!env.aws.region) {
    throw new Error('AWS_REGION is required');
  }
  if (env.env === 'prod' && cfg.dryRun) {
    throw new Error('DEVICE_LOG_ARCHIVE_DRY_RUN=1 is not allowed when NODE_ENV=prod');
  }
  assertTzSafe(cfg.tz);

  return cfg;
}

async function acquireLock(): Promise<void> {
  await fsp.mkdir(path.join(SERVER_ROOT, 'tmp'), { recursive: true });

  try {
    const stat = await fsp.stat(LOCK_DIR);
    if (stat.isDirectory()) {
      let stalePid = '';
      try {
        stalePid = (await fsp.readFile(LOCK_PID_FILE, 'utf8')).trim();
      } catch {
        /* no pid file */
      }
      if (stalePid && isProcessAlive(Number(stalePid))) {
        throw new Error(`archive already running (pid ${stalePid})`);
      }
      log('removing stale lock (no live process)');
      await fsp.rm(LOCK_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }

  await fsp.mkdir(LOCK_DIR);
  await fsp.writeFile(LOCK_PID_FILE, String(process.pid), 'utf8');
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function releaseLock(): Promise<void> {
  await fsp.rm(LOCK_DIR, { recursive: true, force: true }).catch(() => {});
}

async function s3ObjectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e: unknown) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw e;
  }
}

async function deleteS3Object(bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatUploadError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function s3UploadWithRetry(
  localFile: string,
  bucket: string,
  key: string,
  retries: number,
  contentType: string,
): Promise<boolean> {
  const { size } = await fsp.stat(localFile);
  const body = await fsp.readFile(localFile);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: size,
          ContentType: contentType,
        }),
      );
      if (await s3ObjectExists(bucket, key)) {
        return true;
      }
      console.error(`  upload attempt ${attempt}: put ok but head-object missing`);
    } catch (err) {
      console.error(`  upload attempt ${attempt} failed: ${formatUploadError(err)}`);
    }
    if (attempt < retries) {
      await sleep(attempt * 2000);
    }
  }
  return false;
}

async function countSlice(
  client: PoolClient,
  tz: string,
  deviceId: string,
  yearMonth: string,
  window: RetentionWindow,
): Promise<number> {
  await setSessionTz(client, tz);
  const r = await client.query(
    `SELECT count(*)::int AS c FROM device_logs WHERE ${SLICE_WHERE_SQL}`,
    [deviceId, yearMonth, tz, window.start, window.end],
  );
  return r.rows[0]?.c ?? 0;
}

async function exportSliceToCsv(
  client: PoolClient,
  tz: string,
  deviceId: string,
  yearMonth: string,
  window: RetentionWindow,
  outPath: string,
): Promise<number> {
  await setSessionTz(client, tz);
  const count = await countSlice(client, tz, deviceId, yearMonth, window);
  if (count === 0) return 0;

  const copySql = buildSliceCopySql(deviceId, yearMonth, tz, window);
  const copyStream = client.query(copyTo(copySql));
  await pipeline(copyStream, fs.createWriteStream(outPath));
  return count;
}

async function deleteSliceBatched(
  client: PoolClient,
  tz: string,
  deviceId: string,
  yearMonth: string,
  window: RetentionWindow,
  deleteBatch: number,
): Promise<boolean> {
  await setSessionTz(client, tz);
  let totalDeleted = 0;

  while (true) {
    const r = await client.query(
      `WITH deleted AS (
         DELETE FROM device_logs
         WHERE ctid IN (
           SELECT ctid FROM device_logs
           WHERE ${SLICE_WHERE_SQL}
           LIMIT $6
         )
         RETURNING 1
       )
       SELECT count(*)::int AS c FROM deleted`,
      [deviceId, yearMonth, tz, window.start, window.end, deleteBatch],
    );
    const batchDeleted = r.rows[0]?.c ?? 0;
    if (batchDeleted === 0) break;
    totalDeleted += batchDeleted;
    console.log(`  deleted ${batchDeleted} rows (running total: ${totalDeleted})`);
  }

  const remaining = await countSlice(client, tz, deviceId, yearMonth, window);
  if (remaining > 0) {
    console.error(`  warning: ${remaining} rows still in DB (S3 safe — re-run will delete the rest)`);
    return false;
  }
  console.log(`  deleted ${totalDeleted} rows total`);
  return true;
}

async function fetchRetentionWindow(
  client: PoolClient,
  tz: string,
  keepMonths: number,
): Promise<RetentionWindow> {
  await setSessionTz(client, tz);
  const monthsBefore = keepMonths - 1;
  const r = await client.query<{ start: string; end: string }>(
    `SELECT
       (date_trunc('month', now()) - ($1::int * interval '1 month'))::text AS start,
       (date_trunc('month', now()) + interval '1 month')::text AS end`,
    [monthsBefore],
  );
  const row = r.rows[0];
  if (!row?.start || !row?.end) throw new Error('Could not compute retention window');
  return { start: row.start, end: row.end };
}

async function fetchArchiveSlots(
  client: PoolClient,
  tz: string,
  window: RetentionWindow,
): Promise<ArchiveSlot[]> {
  await setSessionTz(client, tz);
  const r = await client.query<{
    device_id: string;
    imei: string;
    device_name: string;
    ym: string;
  }>(
    `SELECT
       dl.device_id::text,
       COALESCE(dv.imei, dl.imei) AS imei,
       regexp_replace(COALESCE(dv.name, ''), E'[[:cntrl:]]', ' ', 'g') AS device_name,
       to_char(date_trunc('month', dl."timestamp"), 'YYYY-MM') AS ym
     FROM device_logs dl
     LEFT JOIN devices dv ON dv.id = dl.device_id
     WHERE dl."timestamp" < $1::timestamptz OR dl."timestamp" >= $2::timestamptz
     GROUP BY dl.device_id, COALESCE(dv.imei, dl.imei), dv.name, date_trunc('month', dl."timestamp")
     ORDER BY ym, imei`,
    [window.start, window.end], 
  );

  return r.rows.map((row) => ({
    deviceId: row.device_id,
    imei: row.imei,
    deviceName: row.device_name ?? '',
    yearMonth: row.ym,
  }));
}

export const task = withCronTask('archive-device-logs', async (): Promise<void> => {
  const cfg = validateConfig();
  const pool = createPool();
  let client: PoolClient | undefined;
  let tempDir = '';

  try {
    await acquireLock();
    client = await pool.connect();

    log('== device_logs archive ==');
    console.log(
      `bucket=${cfg.s3Bucket} prefix=${cfg.s3Prefix} keep_months=${cfg.keepMonths} tz=${cfg.tz} `
      + `dry_run=${cfg.dryRun} force_reexport=${cfg.forceReexport} delete_batch=${cfg.deleteBatch} s3_retries=${cfg.s3Retries}`,
    );

    const retentionWindow = await fetchRetentionWindow(client, cfg.tz, cfg.keepMonths);
    console.log(
      `retention window (keep ${cfg.keepMonths} calendar month(s)): `
      + `[${retentionWindow.start}, ${retentionWindow.end})`,
    );

    const slots = await fetchArchiveSlots(client, cfg.tz, retentionWindow);
    if (slots.length === 0) {
      log('OK: nothing to archive (no rows older than retention window).');
      return;
    }

    console.log(`slots to process: ${slots.length}`);
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'device-log-archive-'));

    let failedSlots = 0;
    let index = 0;

    for (const slot of slots) {
      index += 1;
      const folder = s3FolderForDevice(slot.imei, slot.deviceName);
      const imeiFile = safeSlug(slot.imei, 32) || 'unknown-imei';
      const s3Keys = buildS3ArchiveKeys(cfg.s3Prefix, folder, slot.yearMonth, imeiFile);

      console.log(
        `[${index}/${slots.length}] month=${slot.yearMonth} imei=${slot.imei} -> s3://${cfg.s3Bucket}/${s3Keys.zip}`,
      );

      const existsOnS3 = await s3ArchiveAlreadyStored(cfg.s3Bucket, s3Keys);

      if (existsOnS3 && !cfg.forceReexport) {
        console.log('  already on S3 — skipping upload');
        if (!cfg.dryRun) {
          const storedKey = await resolveStoredS3Key(cfg.s3Bucket, s3Keys);
          await recordArchive(client, slot, cfg, storedKey);
          const ok = await deleteSliceBatched(
            client,
            cfg.tz,
            slot.deviceId,
            slot.yearMonth,
            retentionWindow,
            cfg.deleteBatch,
          );
          if (!ok) failedSlots += 1;
        }
        continue;
      }

      if (existsOnS3 && cfg.forceReexport && !cfg.dryRun) {
        console.log('  force re-export — removing old S3 object(s)');
        await deleteS3Object(cfg.s3Bucket, s3Keys.zip);
        await deleteS3Object(cfg.s3Bucket, s3Keys.legacyGzip);
        await deleteS3Object(cfg.s3Bucket, s3Keys.legacyCsv);
      }

      if (cfg.dryRun) {
        const count = await countSlice(client, cfg.tz, slot.deviceId, slot.yearMonth, retentionWindow);
        console.log(`  dry run: would export ${count} rows, zip upload, then delete`);
        continue;
      }

      const csvPath = path.join(tempDir, `${slot.yearMonth}_${imeiFile}.csv`);
      const zipPath = `${csvPath}.zip`;
      const exported = await exportSliceToCsv(
        client,
        cfg.tz,
        slot.deviceId,
        slot.yearMonth,
        retentionWindow,
        csvPath,
      );

      if (exported === 0) {
        console.log('  skip (no rows left to export)');
        await fsp.unlink(csvPath).catch(() => {});
        continue;
      }

      await zipCsvFile(csvPath, zipPath);
      await fsp.unlink(csvPath).catch(() => {});

      const uploaded = await s3UploadWithRetry(
        zipPath,
        cfg.s3Bucket,
        s3Keys.zip,
        cfg.s3Retries,
        'application/zip',
      );
      await fsp.unlink(zipPath).catch(() => {});

      if (!uploaded) {
        console.error(`  error: S3 upload failed after ${cfg.s3Retries} tries — DB rows kept`);
        failedSlots += 1;
        continue;
      }

      await recordArchive(client, slot, cfg, s3Keys.zip);

      const deleted = await deleteSliceBatched(
        client,
        cfg.tz,
        slot.deviceId,
        slot.yearMonth,
        retentionWindow,
        cfg.deleteBatch,
      );
      if (!deleted) failedSlots += 1;
    }

    if (failedSlots > 0) {
      console.error(
        `ERROR: ${failedSlots} slot(s) had failures (check messages above; safe to re-run).`,
      );
      process.exitCode = 1;
      return;
    }

    log('OK: archive finished.');
  } finally {
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    client?.release();
    await pool.end();
    await releaseLock();
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  task().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
