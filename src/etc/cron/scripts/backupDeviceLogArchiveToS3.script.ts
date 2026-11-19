/**
 * Snapshot device-log archive objects into the shared backup bucket (AWS_S3_BACKUP_BUCKET).
 * Uses S3 CopyObject (server-side; no local disk).
 *
 * Source: DEVICE_LOG_ARCHIVE_S3_BUCKET (+ DEVICE_LOG_ARCHIVE_S3_PREFIX)
 * Dest:   csv_backup / {database}_{YYYY-MM-DD_HH-mm-ss} / …  (flat under csv_backup/, not nested)
 * Retention: same as databaseBackup / fileBackup — keep latest N backup runs by
 * LastModified (run anytime; each run gets a new dated folder).
 *
 * Run: npm run backup-device-log-archive
 * Cron: 05:00 every 10 days (1st, 11th, 21st, 31st, Asia/Kolkata) — scheduled in src/etc/cron/index.ts
 */
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type _Object,
} from '@aws-sdk/client-s3';
import env from '@/config/env.js';
import { s3 } from '@/service/aws/index.js';
import { withCronTask } from '@/core/cron/withCronTask.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '../../../..');
const LOCK_DIR = path.join(SERVER_ROOT, 'tmp/backup-device-log-archive.lock');
const LOCK_PID_FILE = path.join(LOCK_DIR, 'pid');
const IST = 'Asia/Kolkata';

interface BackupConfig {
  sourceBucket: string;
  sourcePrefix: string;
  destBucket: string;
  destPrefix: string;
  retentionFolderPrefix: string;
  database: string;
  backupFolderName: string;
  backupTimestamp: string;
  retentionCount: number;
  dryRun: boolean;
  forceRecopy: boolean;
  copyRetries: number;
  listPageSize: number;
}

interface HeadMeta {
  etag?: string;
  size?: number;
}

function log(message: string): void {
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  console.log(`[${ts}] ${message}`);
}

function formatTimestamp(d = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}`;
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/` : '';
}

function validateConfig(): BackupConfig {
  const archive = env.deviceLogArchive;
  const sourceBucket = archive.s3Bucket.trim();
  const destBucket = (env.aws.s3BackupBucket || env.aws.s3Bucket || '').trim();
  const { database } = env.database;
  const backupTimestamp = formatTimestamp();

  if (!sourceBucket) {
    throw new Error('DEVICE_LOG_ARCHIVE_S3_BUCKET is required');
  }
  if (!destBucket) {
    throw new Error('AWS_S3_BACKUP_BUCKET (or S3_BUCKET) is required');
  }
  if (!database) {
    throw new Error('DATABASE_URL must include a database name');
  }
  if (!env.aws.accessKeyId || !env.aws.secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
  }
  if (!env.aws.region) {
    throw new Error('AWS_REGION is required');
  }
  if (env.env === 'prod' && archive.backupDryRun) {
    throw new Error('DEVICE_LOG_ARCHIVE_BACKUP_DRY_RUN=1 is not allowed when NODE_ENV=prod');
  }

  const backupFolderName = `${database}_${backupTimestamp}`;
  const retentionFolderPrefix = normalizePrefix(archive.backupS3Key);
  const destPrefix = normalizePrefix(path.join(archive.backupS3Key, backupFolderName));

  return {
    sourceBucket,
    sourcePrefix: normalizePrefix(archive.s3Prefix),
    destBucket,
    destPrefix,
    retentionFolderPrefix,
    database,
    backupFolderName,
    backupTimestamp,
    retentionCount: archive.backupRetentionCount,
    dryRun: archive.backupDryRun,
    forceRecopy: archive.backupForceRecopy,
    copyRetries: archive.backupCopyRetries,
    listPageSize: archive.backupListPageSize,
  };
}

function mapDestKey(sourceKey: string, cfg: BackupConfig): string {
  const { sourcePrefix, destPrefix } = cfg;
  if (!sourcePrefix) {
    return `${destPrefix}${sourceKey}`;
  }
  if (!sourceKey.startsWith(sourcePrefix)) {
    return `${destPrefix}${sourceKey}`;
  }
  const relative = sourceKey.slice(sourcePrefix.length);
  return `${destPrefix}${relative}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
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
        throw new Error(`backup already running (pid ${stalePid})`);
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

async function headObject(bucket: string, key: string): Promise<HeadMeta | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { etag: r.ETag, size: r.ContentLength };
  } catch (e: unknown) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw e;
  }
}

async function copyWithRetry(
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string,
  retries: number,
): Promise<boolean> {
  const copySource = encodeURIComponent(`${sourceBucket}/${sourceKey}`);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await s3.send(
        new CopyObjectCommand({
          Bucket: destBucket,
          Key: destKey,
          CopySource: copySource,
        }),
      );
      const dest = await headObject(destBucket, destKey);
      if (dest) return true;
      console.error(`  copy attempt ${attempt}: put ok but head-object missing`);
    } catch (err) {
      console.error(`  copy attempt ${attempt} failed: ${formatError(err)}`);
    }
    if (attempt < retries) {
      await sleep(attempt * 2000);
    }
  }
  return false;
}

async function* listSourceObjects(
  bucket: string,
  prefix: string,
  pageSize: number,
): AsyncGenerator<_Object> {
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: pageSize,
      }),
    );

    for (const obj of res.Contents ?? []) {
      if (obj.Key && !obj.Key.endsWith('/')) {
        yield obj;
      }
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
}

interface ListedObject {
  key: string;
  lastModified: number;
}

async function listAllObjects(bucket: string, prefix: string): Promise<ListedObject[]> {
  const objects: ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of res.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith('/')) continue;
      objects.push({
        key: obj.Key,
        lastModified: obj.LastModified?.getTime() ?? 0,
      });
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

/** e.g. csv_backup/connect1_2026-06-03_14-30-00/foo.zip -> connect1_2026-06-03_14-30-00 */
function extractSnapshotId(key: string, folderPrefix: string): string | null {
  if (!key.startsWith(folderPrefix)) return null;
  const rest = key.slice(folderPrefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return rest.slice(0, slash);
}

interface SnapshotBackup {
  id: string;
  prefix: string;
  lastModified: number;
}

async function deleteObjectsUnderPrefix(bucket: string, prefix: string): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      deleted += 1;
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

/**
 * Same idea as databaseBackup.script.ts applyRetention: sort by LastModified ascending,
 * delete oldest until only retentionCount backups remain. Each dated folder = one backup run.
 */
async function applyRetention(cfg: BackupConfig): Promise<void> {
  const objects = await listAllObjects(cfg.destBucket, cfg.retentionFolderPrefix);
  const groupMap = new Map<string, SnapshotBackup>();

  const dbPrefix = `${cfg.database}_`;

  for (const obj of objects) {
    const id = extractSnapshotId(obj.key, cfg.retentionFolderPrefix);
    if (!id || !id.startsWith(dbPrefix)) continue;

    const existing = groupMap.get(id);
    if (!existing) {
      groupMap.set(id, {
        id,
        prefix: `${cfg.retentionFolderPrefix}${id}/`,
        lastModified: obj.lastModified,
      });
      continue;
    }
    existing.lastModified = Math.max(existing.lastModified, obj.lastModified);
  }

  const backups = [...groupMap.values()].sort((a, b) => a.lastModified - b.lastModified);

  if (backups.length <= cfg.retentionCount) {
    console.log(
      `retention: ${backups.length} backup(s) under ${cfg.retentionFolderPrefix} `
      + `(keep ${cfg.retentionCount}) — nothing to delete`,
    );
    return;
  }

  const toRemove = backups.slice(0, backups.length - cfg.retentionCount);
  console.log(
    `retention: removing ${toRemove.length} oldest backup(s), keeping latest ${cfg.retentionCount} `
    + `(by LastModified, same as postgres/file backups)`,
  );

  for (const backup of toRemove) {
    if (cfg.dryRun) {
      console.log(`  dry run: would delete backup ${backup.id} (${backup.prefix})`);
      continue;
    }
    const n = await deleteObjectsUnderPrefix(cfg.destBucket, backup.prefix);
    console.log(`  deleted ${n} object(s) from ${backup.prefix}`);
  }
}

export const task = withCronTask('backup-device-log-archive', async (): Promise<void> => {
  const cfg = validateConfig();

  try {
    await acquireLock();

    log('== device-log archive S3 backup ==');
    console.log(
      `source=s3://${cfg.sourceBucket}/${cfg.sourcePrefix || '(root)'} `
      + `dest=s3://${cfg.destBucket}/${cfg.destPrefix} `
      + `retention=${cfg.retentionCount} backups for ${cfg.database} under ${cfg.retentionFolderPrefix} `
      + `dry_run=${cfg.dryRun} force_recopy=${cfg.forceRecopy} `
      + `copy_retries=${cfg.copyRetries} list_page_size=${cfg.listPageSize}`,
    );

    let scanned = 0;
    let copied = 0;
    let skipped = 0;
    let failed = 0;

    for await (const obj of listSourceObjects(
      cfg.sourceBucket,
      cfg.sourcePrefix,
      cfg.listPageSize,
    )) {
      const sourceKey = obj.Key!;
      scanned += 1;
      const destKey = mapDestKey(sourceKey, cfg);

      const sourceMeta: HeadMeta = {
        etag: obj.ETag,
        size: obj.Size,
      };

      if (!cfg.forceRecopy) {
        const destMeta = await headObject(cfg.destBucket, destKey);
        if (destMeta?.etag && sourceMeta.etag && destMeta.etag === sourceMeta.etag) {
          skipped += 1;
          continue;
        }
      }

      if (cfg.dryRun) {
        console.log(`  dry run: would copy ${sourceKey} -> ${destKey} (${sourceMeta.size ?? '?'} bytes)`);
        copied += 1;
        continue;
      }

      if (scanned === 1 || scanned % 50 === 0) {
        console.log(`  progress: scanned=${scanned} copied=${copied} skipped=${skipped} failed=${failed}`);
      }

      const ok = await copyWithRetry(
        cfg.sourceBucket,
        sourceKey,
        cfg.destBucket,
        destKey,
        cfg.copyRetries,
      );

      if (ok) {
        copied += 1;
      } else {
        failed += 1;
        console.error(`  error: copy failed for ${sourceKey} -> ${destKey}`);
      }
    }

    console.log(
      `summary: scanned=${scanned} copied=${copied} skipped=${skipped} failed=${failed} `
      + `folder=${cfg.backupFolderName}`,
    );

    if (scanned === 0) {
      console.log(
        `No objects at s3://${cfg.sourceBucket}/${cfg.sourcePrefix} — `
        + 'run the device-log archive job first (exports DB rows to the archive bucket). '
        + `Nothing was written to s3://${cfg.destBucket}/${cfg.destPrefix}`,
      );
    } else if (failed > 0) {
      console.error(`ERROR: ${failed} object(s) failed (safe to re-run).`);
      process.exitCode = 1;
      return;
    }

    await applyRetention(cfg);

    if (scanned === 0) {
      log('OK: nothing to backup (source archive bucket is empty).');
      return;
    }

    log('OK: archive S3 backup finished.');
  } finally {
    await releaseLock();
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  task().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
