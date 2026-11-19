import { fileURLToPath } from 'url';
import Database from '@/service/database/index.js';
import { hardDeleteFile } from '@/modules/file/file.service.js';
import Logger from '@/service/logger/index.js';
import { withCronTask } from '@/core/cron/withCronTask.js';

export const task = withCronTask('flush-files', async () => {
  const db = await Database.getConnection();

  try {

    const filesToDelete = await db.queryAll(`
      SELECT
        id, key, _status
      FROM files
      WHERE
        _status in ('pending', 'deleted') AND
        created_at < NOW() - INTERVAL '5 minute'
    `);

    for (const file of filesToDelete) {
      await hardDeleteFile({ database: db }, { id: file.id });
      Logger.info(`Deleted file: ${file.key}`);
    }

  } finally{
    db.release();
  }

  Logger.info('Process completed');
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  task().catch((error) => {
    Logger.error('Flush files cron failed', error);
    process.exit(1);
  });
}

