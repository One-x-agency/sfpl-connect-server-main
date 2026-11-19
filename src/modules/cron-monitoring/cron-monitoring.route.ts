import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import permission from '@/middleware/auth/permission.js';
import validate from '@/middleware/requestValidator.js';
import {
  Controller as listCronJobs,
  ValidationSchema as listCronJobsValidationSchema,
} from '@/modules/cron-monitoring/controllers/listCronJobs.js';
import {
  Controller as listAllCronJobRuns,
  ValidationSchema as listAllCronJobRunsValidationSchema,
} from '@/modules/cron-monitoring/controllers/listAllCronJobRuns.js';
import {
  Controller as listCronJobRuns,
  ValidationSchema as listCronJobRunsValidationSchema,
} from '@/modules/cron-monitoring/controllers/listCronJobRuns.js';

const router = Router();

const cronAccess = permission('admin');

router.get(
  '/',
  cronAccess,
  validate(listCronJobsValidationSchema),
  listCronJobs,
);

router.get(
  '/runs',
  cronAccess,
  validate(listAllCronJobRunsValidationSchema),
  withDatabase(listAllCronJobRuns),
);

router.get(
  '/:cron_job_key/runs',
  cronAccess,
  validate(listCronJobRunsValidationSchema),
  withDatabase(listCronJobRuns),
);

export default router;
