import { Router } from 'express';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import validate from '@/middleware/requestValidator.js';
import withDatabase from '@/core/withDatabase.js';
import {
  Controller as getMetaData,
  ValidationSchema as getMetaDataValidationSchema,
} from '@/modules/customer-portal/meta/controllers/getMetaData.js';

const router = Router();

router.use(requireCustomerAuth);

router.get(
  '/io-pins',
  validate(getMetaDataValidationSchema),
  withDatabase(getMetaData),
);

export default router;
