import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import {
  Controller as getDashboardPreferences,
  ValidationSchema as getDashboardPreferencesValidationSchema,
} from '@/modules/customer-portal/user/controllers/getDashboardPreferences.js';
import {
  Controller as updateDashboardPreferences,
  ValidationSchema as updateDashboardPreferencesValidationSchema,
} from '@/modules/customer-portal/user/controllers/updateDashboardPreferences.js';

const router = Router();

router.use(requireCustomerAuth);

router.route('/me/dashboard-preferences')
  .get(validate(getDashboardPreferencesValidationSchema), withDatabase(getDashboardPreferences))
  .put(validate(updateDashboardPreferencesValidationSchema), withDatabase(updateDashboardPreferences));

export default router;
