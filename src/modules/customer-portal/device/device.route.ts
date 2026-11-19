import { Router } from 'express';
import { Controller as listDevices, ValidationSchema as listDevicesValidationSchema } from '@/modules/customer-portal/device/controllers/listDevices.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import validate from '@/middleware/requestValidator.js';
import withDatabase from '@/core/withDatabase.js';
import { Controller as getDevice, ValidationSchema as getDeviceValidationSchema } from '@/modules/customer-portal/device/controllers/getDevice.js';
import { Controller as updateDevice, ValidationSchema as updateDeviceValidationSchema } from '@/modules/customer-portal/device/controllers/updateDevice.js';
import { Controller as createDeviceInputField, ValidationSchema as createDeviceInputFieldValidationSchema } from '@/modules/customer-portal/device/controllers/createDeviceInputFields.js';
import { Controller as listDeviceInputFields, ValidationSchema as listDeviceInputFieldsValidationSchema } from '@/modules/customer-portal/device/controllers/listDeviceInputFields.js';
import { Controller as updateDeviceInputField, ValidationSchema as updateDeviceInputFieldValidationSchema } from '@/modules/customer-portal/device/controllers/updateDeviceInputField.js';
import { Controller as deleteDeviceInputField, ValidationSchema as deleteDeviceInputFieldValidationSchema } from '@/modules/customer-portal/device/controllers/deleteDeviceInputField.js';
import {
  Controller as copyDeviceConfig,
  ValidationSchema as copyDeviceConfigValidationSchema,
} from '@/modules/customer-portal/device/controllers/copyDeviceConfig.js';
import { Controller as listDeviceLogs, ValidationSchema as listDeviceLogsValidationSchema } from '@/modules/customer-portal/device/controllers/listDeviceLogs.js';
import {
  Controller as listDeviceLogArchives,
  ValidationSchema as listDeviceLogArchivesValidationSchema,
} from '@/modules/customer-portal/device/controllers/listDeviceLogArchives.js';
import {
  Controller as getDeviceLogArchiveDownload,
  ValidationSchema as getDeviceLogArchiveDownloadValidationSchema,
} from '@/modules/customer-portal/device/controllers/getDeviceLogArchiveDownload.js';
import {
  Controller as listDeviceLogDbMonths,
  ValidationSchema as listDeviceLogDbMonthsValidationSchema,
} from '@/modules/customer-portal/device/controllers/listDeviceLogDbMonths.js';
import {
  Controller as exportDeviceLogDbMonth,
  ValidationSchema as exportDeviceLogDbMonthValidationSchema,
} from '@/modules/customer-portal/device/controllers/exportDeviceLogDbMonth.js';

const router = Router();

router.use(requireCustomerAuth);

router.route('/')
  .get(validate(listDevicesValidationSchema), withDatabase(listDevices));

router.route('/:id')
  .get(validate(getDeviceValidationSchema), withDatabase(getDevice))
  .put(validate(updateDeviceValidationSchema), withDatabase(updateDevice));

router.route('/:id/input-fields')
  .post(validate(createDeviceInputFieldValidationSchema), withDatabase(createDeviceInputField))
  .get(validate(listDeviceInputFieldsValidationSchema), withDatabase(listDeviceInputFields));

router.route('/:id/copy-config')
  .post(validate(copyDeviceConfigValidationSchema), withDatabase(copyDeviceConfig));

router.route('/input-fields/:input_field_id')
  .put(validate(updateDeviceInputFieldValidationSchema), withDatabase(updateDeviceInputField))
  .delete(validate(deleteDeviceInputFieldValidationSchema), withDatabase(deleteDeviceInputField));

router.route('/:id/logs')
  .get(validate(listDeviceLogsValidationSchema), withDatabase(listDeviceLogs));

router.route('/:id/log-archives')
  .get(validate(listDeviceLogArchivesValidationSchema), withDatabase(listDeviceLogArchives));

router.route('/:id/log-archives/:year_month/download')
  .get(validate(getDeviceLogArchiveDownloadValidationSchema), withDatabase(getDeviceLogArchiveDownload));

router.route('/:id/log-db-months')
  .get(validate(listDeviceLogDbMonthsValidationSchema), withDatabase(listDeviceLogDbMonths));

router.route('/:id/log-db-months/:year_month/export')
  .get(validate(exportDeviceLogDbMonthValidationSchema), withDatabase(exportDeviceLogDbMonth));

export default router;
