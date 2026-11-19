import Logger from '@/service/logger/index.js';
import { FlushFilesJob, FlushUnTrackedFilesJob } from '@/modules/file/file.cron.job.js';

void FlushUnTrackedFilesJob.start();
void FlushFilesJob.start();
Logger.info('File crons started (flush untracked: every 10 days 00:00, flush pending: every 3 days 01:00 Asia/Kolkata)');
