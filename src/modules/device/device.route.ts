import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import { Controller as createDevice, ValidationSchema as createDeviceValidationSchema } from '@/modules/device/controllers/createDevice.js';
import { Controller as listDevices, ValidationSchema as listDevicesValidationSchema } from '@/modules/device/controllers/listDevices.js';
import { Controller as getDevice, ValidationSchema as getDeviceValidationSchema } from '@/modules/device/controllers/getDevice.js';
import { Controller as updateDevice, ValidationSchema as updateDeviceValidationSchema } from '@/modules/device/controllers/updateDevice.js';
import { Controller as deleteDevice, ValidationSchema as deleteDeviceValidationSchema } from '@/modules/device/controllers/deleteDevice.js';
import {
  Controller as createDeviceInputField,
  ValidationSchema as createDeviceInputFieldValidationSchema,
} from '@/modules/device/controllers/createDeviceInputFields.js';
import {
  Controller as listDeviceInputFields,
  ValidationSchema as listDeviceInputFieldsValidationSchema,
} from '@/modules/device/controllers/listDeviceInputFields.js';
import {
  Controller as updateDeviceInputField,
  ValidationSchema as updateDeviceInputFieldValidationSchema,
} from '@/modules/device/controllers/updateDeviceInputField.js';
import {
  Controller as deleteDeviceInputField,
  ValidationSchema as deleteDeviceInputFieldValidationSchema,
} from '@/modules/device/controllers/deleteDeviceInputField.js';
import { Controller as listDeviceLogs, ValidationSchema as listDeviceLogsValidationSchema } from '@/modules/device/controllers/listDeviceLogs.js';
import {
  Controller as listDeviceLogArchives,
  ValidationSchema as listDeviceLogArchivesValidationSchema,
} from '@/modules/device/controllers/listDeviceLogArchives.js';
import {
  Controller as getDeviceLogArchiveDownload,
  ValidationSchema as getDeviceLogArchiveDownloadValidationSchema,
} from '@/modules/device/controllers/getDeviceLogArchiveDownload.js';
import {
  Controller as listDeviceLogDbMonths,
  ValidationSchema as listDeviceLogDbMonthsValidationSchema,
} from '@/modules/device/controllers/listDeviceLogDbMonths.js';
import {
  Controller as exportDeviceLogDbMonth,
  ValidationSchema as exportDeviceLogDbMonthValidationSchema,
} from '@/modules/device/controllers/exportDeviceLogDbMonth.js';
import {
  Controller as requestDeviceConfiguration,
  ValidationSchema as requestDeviceConfigurationValidationSchema,
} from '@/modules/device/controllers/requestDeviceConfiguration.js';
import {
  Controller as setDeviceConfiguration,
  ValidationSchema as setDeviceConfigurationValidationSchema,
} from '@/modules/device/controllers/setDeviceConfiguration.js';
import {
  Controller as setDeviceCalibration,
  ValidationSchema as setDeviceCalibrationValidationSchema,
} from '@/modules/device/controllers/setDeviceCalibration.js';

const router = Router();

const deviceReaders = permission('admin', 'qc', 'support');
const pinManagers = permission('admin', 'qc', 'support');
const deviceEditors = permission('admin', 'qc');
const deviceConfigurationRequesters = permission('admin', 'qc', 'support');
const deviceAdmins = permission('admin');

router.route('/')
  .post(permission('admin', 'qc'), validate(createDeviceValidationSchema), withDatabase(createDevice))
  .get(deviceReaders, validate(listDevicesValidationSchema), withDatabase(listDevices));

router.route('/input-fields/:input_field_id')
  .put(pinManagers, validate(updateDeviceInputFieldValidationSchema), withDatabase(updateDeviceInputField))
  .delete(pinManagers, validate(deleteDeviceInputFieldValidationSchema), withDatabase(deleteDeviceInputField));

router.post(
  '/:id/request-configuration',
  deviceConfigurationRequesters,
  validate(requestDeviceConfigurationValidationSchema),
  withDatabase(requestDeviceConfiguration),
);

router.post(
  '/:id/set-configuration',
  deviceEditors,
  validate(setDeviceConfigurationValidationSchema),
  withDatabase(setDeviceConfiguration),
);

router.post(
  '/:id/set-calibration',
  deviceEditors,
  validate(setDeviceCalibrationValidationSchema),
  withDatabase(setDeviceCalibration),
);

router.route('/:id')
  .get(deviceReaders, validate(getDeviceValidationSchema), withDatabase(getDevice))
  .put(deviceEditors, validate(updateDeviceValidationSchema), withDatabase(updateDevice))
  .delete(deviceAdmins, validate(deleteDeviceValidationSchema), withDatabase(deleteDevice));

router.route('/:id/input-fields')
  .post(pinManagers, validate(createDeviceInputFieldValidationSchema), withDatabase(createDeviceInputField))
  .get(deviceReaders, validate(listDeviceInputFieldsValidationSchema), withDatabase(listDeviceInputFields));

router.route('/:id/logs')
  .get(deviceReaders, validate(listDeviceLogsValidationSchema), withDatabase(listDeviceLogs));

router.route('/:id/log-archives')
  .get(deviceReaders, validate(listDeviceLogArchivesValidationSchema), withDatabase(listDeviceLogArchives));

router.route('/:id/log-archives/:year_month/download')
  .get(deviceReaders, validate(getDeviceLogArchiveDownloadValidationSchema), withDatabase(getDeviceLogArchiveDownload));

router.route('/:id/log-db-months')
  .get(deviceReaders, validate(listDeviceLogDbMonthsValidationSchema), withDatabase(listDeviceLogDbMonths));

router.route('/:id/log-db-months/:year_month/export')
  .get(deviceReaders, validate(exportDeviceLogDbMonthValidationSchema), withDatabase(exportDeviceLogDbMonth));

export default router;
