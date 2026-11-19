import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import {
  Controller as getDashboardStats,
  ValidationSchema as getDashboardStatsValidationSchema,
} from '@/modules/customer-portal/dashboard/controllers/getDashboardStats.js';
import {
  Controller as getDevicePinHistory,
  ValidationSchema as getDevicePinHistoryValidationSchema,
} from '@/modules/dashboard/controllers/getDevicePinHistory.js';
import {
  Controller as getDeviceStatusHeatmap,
  ValidationSchema as getDeviceStatusHeatmapValidationSchema,
} from '@/modules/dashboard/controllers/getDeviceStatusHeatmap.js';
import {
  Controller as getProjectDevicePie,
  ValidationSchema as getProjectDevicePieValidationSchema,
} from '@/modules/customer-portal/dashboard/controllers/getProjectDevicePie.js';
import validate from '@/middleware/requestValidator.js';

const router = Router();

router.use(requireCustomerAuth);

router.get(
  '/stats',
  validate(getDashboardStatsValidationSchema),
  withDatabase(getDashboardStats),
);

router.get(
  '/device-pin-history',
  validate(getDevicePinHistoryValidationSchema),
  withDatabase(getDevicePinHistory),
);

router.get(
  '/device-status-heatmap',
  validate(getDeviceStatusHeatmapValidationSchema),
  withDatabase(getDeviceStatusHeatmap),
);

router.get(
  '/project-device-pie',
  validate(getProjectDevicePieValidationSchema),
  withDatabase(getProjectDevicePie),
);

export default router;
