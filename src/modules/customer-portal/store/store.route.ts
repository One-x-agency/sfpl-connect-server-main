import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import parseStorefrontAuth from '@/middleware/auth/parseStorefrontAuth.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';

import {
  Controller as listDevices,
  ValidationSchema as listDevicesValidationSchema,
} from '@/modules/customer-portal/store/controllers/device/listDevices.js';
import {
  Controller as getDeviceBySlug,
  ValidationSchema as getDeviceBySlugValidationSchema,
} from '@/modules/customer-portal/store/controllers/device/getDeviceBySlug.js';
import { Controller as getCart } from '@/modules/customer-portal/store/controllers/cart/getCart.js';
import {
  Controller as updateCartItem,
  ValidationSchema as updateCartItemValidationSchema,
} from '@/modules/customer-portal/store/controllers/cart/updateCartItem.js';
import {
  Controller as mergeCart,
  ValidationSchema as mergeCartValidationSchema,
} from '@/modules/customer-portal/store/controllers/cart/mergeCart.js';
import { Controller as listStates } from '@/modules/customer-portal/store/controllers/address/listStates.js';
import { Controller as getAddresses } from '@/modules/customer-portal/store/controllers/address/getAddresses.js';
import {
  Controller as upsertAddress,
  ValidationSchema as upsertAddressValidationSchema,
} from '@/modules/customer-portal/store/controllers/address/upsertAddress.js';
import {
  Controller as upsertAccountDetails,
  ValidationSchema as upsertAccountDetailsValidationSchema,
} from '@/modules/customer-portal/store/controllers/account-details/upsertAccountDetails.js';
import { Controller as getAccountDetails } from '@/modules/customer-portal/store/controllers/account-details/getAccountDetails.js';
import {
  Controller as createOrder,
  ValidationSchema as createOrderValidationSchema,
} from '@/modules/customer-portal/store/controllers/order/createOrder.js';
import {
  Controller as verifyOrder,
  ValidationSchema as verifyOrderValidationSchema,
} from '@/modules/customer-portal/store/controllers/order/verifyOrder.js';
import {
  Controller as listOrders,
  ValidationSchema as listOrdersValidationSchema,
} from '@/modules/customer-portal/store/controllers/order/listOrders.js';
import {
  Controller as getOrder,
  ValidationSchema as getOrderValidationSchema,
} from '@/modules/customer-portal/store/controllers/order/getOrder.js';
import {
  Controller as getOrderInvoice,
  ValidationSchema as getOrderInvoiceValidationSchema,
} from '@/modules/customer-portal/store/controllers/order/getOrderInvoice.js';

const router = Router();

router.get('/devices', validate(listDevicesValidationSchema), withDatabase(listDevices));
router.get('/devices/:slug', validate(getDeviceBySlugValidationSchema), withDatabase(getDeviceBySlug));
router.get('/states', withDatabase(listStates));

router.use(parseStorefrontAuth);
router.get('/cart', withDatabase(getCart));
router.put('/cart/:device_id', validate(updateCartItemValidationSchema), withDatabase(updateCartItem));

router.post('/cart/merge', requireCustomerAuth, validate(mergeCartValidationSchema), withDatabase(mergeCart));

router.get('/addresses', requireCustomerAuth, withDatabase(getAddresses));
router.put('/addresses/:type', requireCustomerAuth, validate(upsertAddressValidationSchema), withDatabase(upsertAddress));

router.get('/account-details', requireCustomerAuth, withDatabase(getAccountDetails));
router.put('/account-details', requireCustomerAuth, validate(upsertAccountDetailsValidationSchema), withDatabase(upsertAccountDetails));

router.post('/orders', requireCustomerAuth, validate(createOrderValidationSchema), withDatabase(createOrder));
router.post('/orders/verify', requireCustomerAuth, validate(verifyOrderValidationSchema), withDatabase(verifyOrder));
router.get('/orders', requireCustomerAuth, validate(listOrdersValidationSchema), withDatabase(listOrders));
router.get('/orders/:order_id/invoice', requireCustomerAuth, validate(getOrderInvoiceValidationSchema), withDatabase(getOrderInvoice));
router.get('/orders/:order_id', requireCustomerAuth, validate(getOrderValidationSchema), withDatabase(getOrder));

export default router;
