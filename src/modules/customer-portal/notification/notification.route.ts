import { Router } from 'express';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import withDatabase from '@/core/withDatabase.js';
import { Controller as listNotifications } from '@/modules/customer-portal/notification/controllers/listNotifications.js';
import { ValidationSchema as upsertNotificationTokenValidationSchema, Controller as upsertNotificationToken } from '@/modules/customer-portal/notification/controllers/upsertNotificationToken.js';
import { Controller as markAllNotificationsSeen } from '@/modules/customer-portal/notification/controllers/markAllNotificationsSeen.js';
import { ValidationSchema as markNotificationSeenValidationSchema, Controller as markNotificationSeen } from '@/modules/customer-portal/notification/controllers/markNotificationSeen.js';
import { ValidationSchema as markNotificationUnreadValidationSchema, Controller as markNotificationUnread } from '@/modules/customer-portal/notification/controllers/markNotificationUnread.js';
import validateRequest from '@/middleware/requestValidator.js';

const router = Router();

router.use(requireCustomerAuth);

router.route('/')
  .get(withDatabase(listNotifications));

router.route('/seen-all')
  .patch(withDatabase(markAllNotificationsSeen));

router.route('/:id/seen')
  .patch(
    validateRequest(markNotificationSeenValidationSchema),
    withDatabase(markNotificationSeen),
  );

router.route('/:id/unread')
  .patch(
    validateRequest(markNotificationUnreadValidationSchema),
    withDatabase(markNotificationUnread),
  );

router.route('/tokens')
  .post(validateRequest(upsertNotificationTokenValidationSchema), withDatabase(upsertNotificationToken));

export default router;

