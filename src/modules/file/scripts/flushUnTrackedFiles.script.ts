import { fileURLToPath } from 'url';
import Database from '@/service/database/index.js';
import { getAllFileKeys } from '@/service/file-storage/index.js';
import path from 'path';
import env from '@/config/env.js';
import fsp from 'fs/promises';
import Logger from '@/service/logger/index.js';
import { withCronTask } from '@/core/cron/withCronTask.js';

export const task = withCronTask('flush-untracked-files', async () => {

  const dbFiles = await Database.queryAll(`
      SELECT id, key, _status FROM files
    `);

  const dbFilesKeys = dbFiles.map((file) => file.key);
  const storageFiles = await getAllFileKeys();

  for (const file of storageFiles) {
    if (!dbFilesKeys.includes(file)) {
      await fsp.unlink(path.join(env.fileStoragePath, file));
      Logger.info(`Deleted file: ${file}`);
    }
  }

  Logger.info('Process completed');
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  task().catch((error) => {
    Logger.error('Flush untracked files cron failed', error);
    process.exit(1);
  });
}

