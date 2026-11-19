import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import {
  Controller as createConnectStoreDevice,
  ValidationSchema as createConnectStoreDeviceValidationSchema,
} from '@/modules/connect-store-device/controllers/createConnectStoreDevice.js';
import {
  Controller as listConnectStoreDevices,
  ValidationSchema as listConnectStoreDevicesValidationSchema,
} from '@/modules/connect-store-device/controllers/listConnectStoreDevices.js';
import {
  Controller as getConnectStoreDevice,
  ValidationSchema as getConnectStoreDeviceValidationSchema,
} from '@/modules/connect-store-device/controllers/getConnectStoreDevice.js';
import {
  Controller as updateConnectStoreDevice,
  ValidationSchema as updateConnectStoreDeviceValidationSchema,
} from '@/modules/connect-store-device/controllers/updateConnectStoreDevice.js';

const router = Router();

const storeDeviceAccess = permission('admin');

router.route('/')
  .get(storeDeviceAccess, validate(listConnectStoreDevicesValidationSchema), withDatabase(listConnectStoreDevices))
  .post(storeDeviceAccess, validate(createConnectStoreDeviceValidationSchema), withDatabase(createConnectStoreDevice));

router.route('/:id')
  .get(storeDeviceAccess, validate(getConnectStoreDeviceValidationSchema), withDatabase(getConnectStoreDevice))
  .put(storeDeviceAccess, validate(updateConnectStoreDeviceValidationSchema), withDatabase(updateConnectStoreDevice));

export default router;
