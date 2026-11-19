import Logger from '@/service/logger/index.js';
import { PurgeDeletedCustomersJob } from '@/modules/customer/customer.cron.job.js';

void PurgeDeletedCustomersJob.start();
Logger.info('Customer purge cron started (daily at 03:00 Asia/Kolkata)');
