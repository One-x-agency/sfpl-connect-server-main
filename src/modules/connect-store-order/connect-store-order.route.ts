import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import {
  Controller as listConnectStoreOrders,
  ValidationSchema as listConnectStoreOrdersValidationSchema,
} from '@/modules/connect-store-order/controllers/listConnectStoreOrders.js';
import {
  Controller as getConnectStoreOrdersReport,
  ValidationSchema as getConnectStoreOrdersReportValidationSchema,
} from '@/modules/connect-store-order/controllers/getConnectStoreOrdersReport.js';
import {
  Controller as getConnectStoreOrder,
  ValidationSchema as getConnectStoreOrderValidationSchema,
} from '@/modules/connect-store-order/controllers/getConnectStoreOrder.js';
import {
  Controller as getConnectStoreOrderInvoice,
  ValidationSchema as getConnectStoreOrderInvoiceValidationSchema,
} from '@/modules/connect-store-order/controllers/getConnectStoreOrderInvoice.js';
import {
  Controller as startOrderProcessing,
  ValidationSchema as startOrderProcessingValidationSchema,
} from '@/modules/connect-store-order/controllers/transitions/startOrderProcessing.js';
import {
  Controller as shipConnectStoreOrder,
  ValidationSchema as shipConnectStoreOrderValidationSchema,
} from '@/modules/connect-store-order/controllers/transitions/shipConnectStoreOrder.js';
import {
  Controller as sendConnectStoreOrderOtp,
  ValidationSchema as sendConnectStoreOrderOtpValidationSchema,
} from '@/modules/connect-store-order/controllers/transitions/sendConnectStoreOrderOtp.js';
import {
  Controller as markConnectStoreOrderDelivered,
  ValidationSchema as markConnectStoreOrderDeliveredValidationSchema,
} from '@/modules/connect-store-order/controllers/transitions/markConnectStoreOrderDelivered.js';
import {
  Controller as completeConnectStoreOrder,
  ValidationSchema as completeConnectStoreOrderValidationSchema,
} from '@/modules/connect-store-order/controllers/transitions/completeConnectStoreOrder.js';
import {
  Controller as updateConnectStoreOrderAddresses,
  ValidationSchema as updateConnectStoreOrderAddressesValidationSchema,
} from '@/modules/connect-store-order/controllers/updateConnectStoreOrderAddresses.js';
import {
  Controller as listOrderStates,
  ValidationSchema as listOrderStatesValidationSchema,
} from '@/modules/connect-store-order/controllers/listOrderStates.js';

const router = Router();

const orderReaders = permission('admin', 'support', 'accountant', 'warehouse');
const orderProcessors = permission('admin', 'accountant');
const orderAddressEditors = permission('admin', 'accountant');
const orderShippers = permission('admin', 'warehouse');
const orderDeliverers = permission('admin', 'warehouse');
const orderCompleters = permission('admin', 'support');
const orderReportReaders = permission('admin');
const orderOtpSenders = permission('admin', 'support', 'warehouse');

router.route('/')
  .get(orderReaders, validate(listConnectStoreOrdersValidationSchema), withDatabase(listConnectStoreOrders));

router.get(
  '/report',
  orderReportReaders,
  validate(getConnectStoreOrdersReportValidationSchema),
  withDatabase(getConnectStoreOrdersReport),
);

router.get(
  '/states',
  orderReaders,
  validate(listOrderStatesValidationSchema),
  withDatabase(listOrderStates),
);

router.route('/:id')
  .get(orderReaders, validate(getConnectStoreOrderValidationSchema), withDatabase(getConnectStoreOrder));

router.get(
  '/:id/invoice',
  orderReaders,
  validate(getConnectStoreOrderInvoiceValidationSchema),
  withDatabase(getConnectStoreOrderInvoice),
);

router.route('/:id/addresses')
  .patch(
    orderAddressEditors,
    validate(updateConnectStoreOrderAddressesValidationSchema),
    withDatabase(updateConnectStoreOrderAddresses),
  );

router.route('/:id/processing')
  .post(orderProcessors, validate(startOrderProcessingValidationSchema), withDatabase(startOrderProcessing));

router.route('/:id/shipping')
  .post(orderShippers, validate(shipConnectStoreOrderValidationSchema), withDatabase(shipConnectStoreOrder));

router.route('/:id/send-otp')
  .post(orderOtpSenders, validate(sendConnectStoreOrderOtpValidationSchema), withDatabase(sendConnectStoreOrderOtp));

router.route('/:id/delivered')
  .post(orderDeliverers, validate(markConnectStoreOrderDeliveredValidationSchema), withDatabase(markConnectStoreOrderDelivered));

router.route('/:id/complete')
  .post(orderCompleters, validate(completeConnectStoreOrderValidationSchema), withDatabase(completeConnectStoreOrder));

export default router;
