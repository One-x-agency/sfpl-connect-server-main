import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';
import { STAFF_ROLES } from '@/constants/user-role.js';

import { Controller as registerUser, ValidationSchema as registerUserValidationSchema } from '@/modules/auth/controllers/registerUser.js';
import { Controller as verifyRegistration, ValidationSchema as verifyRegistrationValidationSchema } from '@/modules/auth/controllers/verifyRegistration.js';
import { Controller as loginUser, ValidationSchema as loginUserValidationSchema } from '@/modules/auth/controllers/loginUser.js';
import { Controller as forgotPassword, ValidationSchema as forgotPasswordValidationSchema } from '@/modules/auth/controllers/forgotPassword.js';
import { Controller as resetPassword, ValidationSchema as resetPasswordValidationSchema } from '@/modules/auth/controllers/resetPassword.js';
import {
  Controller as getDashboardPreferences,
  ValidationSchema as getDashboardPreferencesValidationSchema,
} from '@/modules/user/controllers/getDashboardPreferences.js';
import {
  Controller as updateDashboardPreferences,
  ValidationSchema as updateDashboardPreferencesValidationSchema,
} from '@/modules/user/controllers/updateDashboardPreferences.js';

const router = Router();

router.route('/register')
  .post(validate(registerUserValidationSchema), withDatabase(registerUser));

router.route('/verify-registration')
  .post(validate(verifyRegistrationValidationSchema), withDatabase(verifyRegistration));

router.route('/login')
  .post(validate(loginUserValidationSchema), withDatabase(loginUser));

router.route('/forgot-password')
  .post(validate(forgotPasswordValidationSchema), withDatabase(forgotPassword));

router.route('/reset-password')
  .post(validate(resetPasswordValidationSchema), withDatabase(resetPassword));

router.route('/me/dashboard-preferences')
  .get(
    permission(...STAFF_ROLES),
    validate(getDashboardPreferencesValidationSchema),
    withDatabase(getDashboardPreferences),
  )
  .put(
    permission(...STAFF_ROLES),
    validate(updateDashboardPreferencesValidationSchema),
    withDatabase(updateDashboardPreferences),
  );

export default router;
