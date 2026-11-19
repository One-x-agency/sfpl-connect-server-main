import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import permission from '@/middleware/auth/permission.js';
import validate from '@/middleware/requestValidator.js';
import {
  Controller as listActivityLogs,
  ValidationSchema as listActivityLogsValidationSchema,
} from '@/modules/activity-log/controllers/listActivityLogs.js';

const router = Router();

const activityAccess = permission('admin');

router.get(
  '/',
  activityAccess,
  validate(listActivityLogsValidationSchema),
  withDatabase(listActivityLogs),
);

export default router;
