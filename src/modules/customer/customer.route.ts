import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import { Controller as listCustomers, ValidationSchema as listCustomersValidationSchema } from '@/modules/customer/controllers/listCustomers.js';
import { Controller as getCustomer, ValidationSchema as getCustomerValidationSchema } from '@/modules/customer/controllers/getCustomer.js';
import { Controller as activateCustomer, ValidationSchema as activateCustomerValidationSchema } from '@/modules/customer/controllers/activateCustomer.js';
import { Controller as listCustomerAlerts, ValidationSchema as listCustomerAlertsValidationSchema } from '@/modules/customer/controllers/listCustomerAlerts.js';
import { Controller as getCustomerCart, ValidationSchema as getCustomerCartValidationSchema } from '@/modules/customer/controllers/getCustomerCart.js';
import { Controller as updateCustomerCartRemark, ValidationSchema as updateCustomerCartRemarkValidationSchema } from '@/modules/customer/controllers/updateCustomerCartRemark.js';

const router = Router();

const customerAccess = permission('admin', 'support');
const customerListReaders = permission('admin', 'support', 'qc');

router.route('/')
  .get(customerListReaders, validate(listCustomersValidationSchema), withDatabase(listCustomers));

router.route('/:id')
  .get(customerAccess, validate(getCustomerValidationSchema), withDatabase(getCustomer));

router.route('/:id/alerts')
  .get(customerAccess, validate(listCustomerAlertsValidationSchema), withDatabase(listCustomerAlerts));

router.route('/:id/cart')
  .get(customerAccess, validate(getCustomerCartValidationSchema), withDatabase(getCustomerCart))
  .patch(customerAccess, validate(updateCustomerCartRemarkValidationSchema), withDatabase(updateCustomerCartRemark));

router.route('/:id/activate')
  .post(customerAccess, validate(activateCustomerValidationSchema), withDatabase(activateCustomer));

export default router;
