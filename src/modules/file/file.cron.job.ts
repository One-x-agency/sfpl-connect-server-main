import path from 'path';
import { fileURLToPath } from 'url';
import { createCronJob } from '@/core/cron/createCronJob.js';
import { task as flushUnTrackedFilesTask } from './scripts/flushUnTrackedFiles.script.js';
import { task as flushFilesTask } from './scripts/flushFiles.script.js';

/**
# ┌────────────── second (optional)
# │ ┌──────────── minute
# │ │ ┌────────── hour
# │ │ │ ┌──────── day of month
# │ │ │ │ ┌────── month
# │ │ │ │ │ ┌──── day of week
# │ │ │ │ │ │
# │ │ │ │ │ │
# * * * * * *
*/
const cronDir = path.dirname(fileURLToPath(import.meta.url));

export const FlushUnTrackedFilesJob = createCronJob({
  key: 'flush-untracked-files',
  name: 'Flush Untracked Files',
  schedule: '0 0 */10 * *',
  timezone: 'Asia/Kolkata',
  description: 'Remove files from disk that are not tracked in the database',
  module: 'file',
  task: flushUnTrackedFilesTask,
  scriptPath: path.resolve(cronDir, './scripts/flushUnTrackedFiles.script.js'),
});

export const FlushFilesJob = createCronJob({
  key: 'flush-files',
  name: 'Flush Pending Files',
  schedule: '0 1 */3 * *',
  timezone: 'Asia/Kolkata',
  description: 'Hard-delete pending or deleted file records older than 5 minutes',
  module: 'file',
  task: flushFilesTask,
  scriptPath: path.resolve(cronDir, './scripts/flushFiles.script.js'),
});
