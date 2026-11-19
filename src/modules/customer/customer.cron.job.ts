import path from 'path';
import { fileURLToPath } from 'url';
import { createCronJob } from '@/core/cron/createCronJob.js';
import { task as purgeDeletedCustomersTask } from '@/modules/customer/scripts/purgeDeletedCustomers.script.js';

const cronDir = path.dirname(fileURLToPath(import.meta.url));

export const PurgeDeletedCustomersJob = createCronJob({
  key: 'purge-deleted-customers',
  name: 'Purge Deleted Customers',
  schedule: '0 3 * * *',
  timezone: 'Asia/Kolkata',
  description: 'Clean up related data for customers soft-deleted for more than 20 days',
  module: 'customer',
  task: purgeDeletedCustomersTask,
  scriptPath: path.resolve(cronDir, './scripts/purgeDeletedCustomers.script.js'),
});
