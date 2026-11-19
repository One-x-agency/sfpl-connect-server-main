import path from 'path';
import { fileURLToPath } from 'url';
import env from '@/config/env.js';
import Logger from '@/service/logger/index.js';
import { createCronJob } from '@/core/cron/createCronJob.js';
import { task as databaseBackupTask } from '@/etc/cron/scripts/databaseBackup.script.js';
import { task as fileBackupTask } from '@/etc/cron/scripts/fileBackup.script.js';
import { task as archiveDeviceLogsTask } from '@/etc/cron/scripts/archiveDeviceLogsToS3.script.js';
import { task as backupDeviceLogArchiveTask } from '@/etc/cron/scripts/backupDeviceLogArchiveToS3.script.js';

const cronDir = path.dirname(fileURLToPath(import.meta.url));

const archiveDeviceLogsEnabled = Boolean(env.deviceLogArchive.s3Bucket?.trim());
const backupDeviceLogArchiveEnabled = Boolean(
  env.deviceLogArchive.s3Bucket?.trim()
  && (env.aws.s3BackupBucket?.trim() || env.aws.s3Bucket?.trim()),
);

export const DatabaseBackupJob = createCronJob({
  key: 'database-backup',
  name: 'Database Backup',
  schedule: '30 2 * * *',
  timezone: 'Asia/Kolkata',
  description: 'Daily PostgreSQL dump to S3 backup bucket',
  module: 'backup',
  task: databaseBackupTask,
  scriptPath: path.resolve(cronDir, './scripts/databaseBackup.script.js'),
});

export const FileBackupJob = createCronJob({
  key: 'file-backup',
  name: 'File Backup',
  schedule: '0 3 */3 * *',
  timezone: 'Asia/Kolkata',
  description: 'Zip and upload file storage to S3 every 3 days',
  module: 'backup',
  task: fileBackupTask,
  scriptPath: path.resolve(cronDir, './scripts/fileBackup.script.js'),
});

export const ArchiveDeviceLogsJob = createCronJob({
  key: 'archive-device-logs',
  name: 'Archive Device Logs',
  schedule: '0 4 1,16 * *',
  timezone: 'Asia/Kolkata',
  description: 'Archive device logs to S3 on the 1st and 16th of each month',
  module: 'device',
  task: archiveDeviceLogsTask,
  scriptPath: path.resolve(cronDir, './scripts/archiveDeviceLogsToS3.script.js'),
  enabled: archiveDeviceLogsEnabled,
});

export const BackupDeviceLogArchiveJob = createCronJob({
  key: 'backup-device-log-archive',
  name: 'Backup Device Log Archive',
  schedule: '0 5 */10 * *',
  timezone: 'Asia/Kolkata',
  description: 'Mirror device log archive bucket to backup bucket every 10 days',
  module: 'device',
  task: backupDeviceLogArchiveTask,
  scriptPath: path.resolve(cronDir, './scripts/backupDeviceLogArchiveToS3.script.js'),
  enabled: backupDeviceLogArchiveEnabled,
});

void DatabaseBackupJob.start();
void FileBackupJob.start();

if (archiveDeviceLogsEnabled) {
  void ArchiveDeviceLogsJob.start();
}

if (backupDeviceLogArchiveEnabled) {
  void BackupDeviceLogArchiveJob.start();
}

const archiveCronNote = archiveDeviceLogsEnabled
  ? 'Device logs S3 archive: every 15 days 04:00 (1st & 16th)'
  : 'Device logs S3 archive cron disabled (DEVICE_LOG_ARCHIVE_S3_BUCKET not set)';

const archiveBackupCronNote = backupDeviceLogArchiveEnabled
  ? 'Device log archive S3 backup: every 10 days 05:00 (1st, 11th, 21st, 31st)'
  : 'Device log archive S3 backup cron disabled (DEVICE_LOG_ARCHIVE_S3_BUCKET or AWS_S3_BACKUP_BUCKET not set)';

Logger.info(
  `Backup crons started (DB: daily 02:30, Files: every 3 days 03:00, ${archiveCronNote}, `
  + `${archiveBackupCronNote}, Asia/Kolkata)`,
);
