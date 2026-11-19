import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import validate from '@/middleware/requestValidator.js';

import {
  Controller as createCustomNotification,
  ValidationSchema as createCustomNotificationValidationSchema,
} from '@/modules/customer-portal/custom-notification/controller/createCustomNotification.js';
import {
  Controller as listCustomNotifications,
  ValidationSchema as listCustomNotificationsValidationSchema,
} from '@/modules/customer-portal/custom-notification/controller/listCustomNotifications.js';
import {
  Controller as getCustomNotification,
  ValidationSchema as getCustomNotificationValidationSchema,
} from '@/modules/customer-portal/custom-notification/controller/getCustomNotification.js';
import {
  Controller as updateCustomNotification,
  ValidationSchema as updateCustomNotificationValidationSchema,
} from '@/modules/customer-portal/custom-notification/controller/updateCustomNotification.js';
import {
  Controller as deleteCustomNotification,
  ValidationSchema as deleteCustomNotificationValidationSchema,
} from '@/modules/customer-portal/custom-notification/controller/deleteCustomNotification.js';

const router = Router();

router.use(requireCustomerAuth);

router.route('/')
  .get(
    validate(listCustomNotificationsValidationSchema),
    withDatabase(listCustomNotifications),
  )
  .post(
    validate(createCustomNotificationValidationSchema),
    withDatabase(createCustomNotification),
  );

router.route('/:id')
  .get(
    validate(getCustomNotificationValidationSchema),
    withDatabase(getCustomNotification),
  )
  .put(
    validate(updateCustomNotificationValidationSchema),
    withDatabase(updateCustomNotification),
  )
  .delete(
    validate(deleteCustomNotificationValidationSchema),
    withDatabase(deleteCustomNotification),
  );

export default router;

