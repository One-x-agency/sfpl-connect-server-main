import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';
import { STAFF_ROLES } from '@/constants/user-role.js';
import {
  Controller as getDashboardPreferences,
  ValidationSchema as getDashboardPreferencesValidationSchema,
} from '@/modules/user/controllers/getDashboardPreferences.js';
import {
  Controller as updateDashboardPreferences,
  ValidationSchema as updateDashboardPreferencesValidationSchema,
} from '@/modules/user/controllers/updateDashboardPreferences.js';
import {
  Controller as listStaff,
  ValidationSchema as listStaffValidationSchema,
} from '@/modules/user/controllers/staff/listStaff.js';
import {
  Controller as createStaff,
  ValidationSchema as createStaffValidationSchema,
} from '@/modules/user/controllers/staff/createStaff.js';
import {
  Controller as getStaff,
  ValidationSchema as getStaffValidationSchema,
} from '@/modules/user/controllers/staff/getStaff.js';
import {
  Controller as updateStaff,
  ValidationSchema as updateStaffValidationSchema,
} from '@/modules/user/controllers/staff/updateStaff.js';
import {
  Controller as deleteStaff,
  ValidationSchema as deleteStaffValidationSchema,
} from '@/modules/user/controllers/staff/deleteStaff.js';
import {
  Controller as updateStaffStatus,
  ValidationSchema as updateStaffStatusValidationSchema,
} from '@/modules/user/controllers/staff/updateStaffStatus.js';
import {
  Controller as activateStaff,
  ValidationSchema as activateStaffValidationSchema,
} from '@/modules/user/controllers/staff/activateStaff.js';

const router = Router();

const staffAccess = permission(...STAFF_ROLES);
const adminAccess = permission('admin');

router.route('/me/dashboard-preferences')
  .get(staffAccess, validate(getDashboardPreferencesValidationSchema), withDatabase(getDashboardPreferences))
  .put(staffAccess, validate(updateDashboardPreferencesValidationSchema), withDatabase(updateDashboardPreferences));

router.route('/staff')
  .get(adminAccess, validate(listStaffValidationSchema), withDatabase(listStaff))
  .post(adminAccess, validate(createStaffValidationSchema), withDatabase(createStaff));

router.route('/staff/:staff_id/status')
  .patch(adminAccess, validate(updateStaffStatusValidationSchema), withDatabase(updateStaffStatus));

router.route('/staff/:staff_id/activate')
  .post(adminAccess, validate(activateStaffValidationSchema), withDatabase(activateStaff));

router.route('/staff/:staff_id')
  .get(adminAccess, validate(getStaffValidationSchema), withDatabase(getStaff))
  .put(adminAccess, validate(updateStaffValidationSchema), withDatabase(updateStaff))
  .delete(adminAccess, validate(deleteStaffValidationSchema), withDatabase(deleteStaff));

export default router;
