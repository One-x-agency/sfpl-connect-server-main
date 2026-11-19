import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import permission from '@/middleware/auth/permission.js';
import { Controller as getDashboardStats, ValidationSchema as getDashboardStatsValidationSchema } from '@/modules/dashboard/controllers/getDashboardStats.js';
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
} from '@/modules/dashboard/controllers/getProjectDevicePie.js';
import validate from '@/middleware/requestValidator.js';

const router = Router();

const dashboardAccess = permission('admin', 'support', 'qc');

router.get(
  '/stats',
  dashboardAccess,
  validate(getDashboardStatsValidationSchema),
  withDatabase(getDashboardStats),
);

router.get(
  '/device-pin-history',
  dashboardAccess,
  validate(getDevicePinHistoryValidationSchema),
  withDatabase(getDevicePinHistory),
);

router.get(
  '/device-status-heatmap',
  dashboardAccess,
  validate(getDeviceStatusHeatmapValidationSchema),
  withDatabase(getDeviceStatusHeatmap),
);

router.get(
  '/project-device-pie',
  dashboardAccess,
  validate(getProjectDevicePieValidationSchema),
  withDatabase(getProjectDevicePie),
);

export default router;
