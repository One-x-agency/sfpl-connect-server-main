import { Router } from 'express';
import permission from '@/middleware/auth/permission.js';
import validate from '@/middleware/requestValidator.js';
import withDatabase from '@/core/withDatabase.js';
import { Controller as getMetaData, ValidationSchema as getMetaDataValidationSchema } from '@/modules/meta-data/controllers/getMetaData.js';

const router = Router();

router.get(
  '/',
  permission('admin', 'qc', 'support'),
  validate(getMetaDataValidationSchema),
  withDatabase(getMetaData),
);

export default router;
