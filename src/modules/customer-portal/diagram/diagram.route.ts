import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import parseCustomer from '@/middleware/auth/parseCustomer.js';
import validate from '@/middleware/requestValidator.js';

import { Controller as listDiagrams } from '@/modules/customer-portal/diagram/controllers/listDiagrams.js';
import { Controller as createDiagram, ValidationSchema as createDiagramValidationSchema } from '@/modules/customer-portal/diagram/controllers/createDiagram.js';
import { Controller as getDiagram, ValidationSchema as getDiagramValidationSchema } from '@/modules/customer-portal/diagram/controllers/getDiagram.js';
import { Controller as updateDiagram, ValidationSchema as updateDiagramValidationSchema } from '@/modules/customer-portal/diagram/controllers/updateDiagram.js';
import { Controller as deleteDiagram, ValidationSchema as deleteDiagramValidationSchema } from '@/modules/customer-portal/diagram/controllers/deleteDiagram.js';
import { Controller as listDiagramImages, ValidationSchema as listDiagramImagesValidationSchema } from '@/modules/customer-portal/diagram/controllers/listDiagramImages.js';
import { Controller as createDiagramImage, ValidationSchema as createDiagramImageValidationSchema } from '@/modules/customer-portal/diagram/controllers/createDiagramImage.js';
import { Controller as deleteDiagramImage, ValidationSchema as deleteDiagramImageValidationSchema } from '@/modules/customer-portal/diagram/controllers/deleteDiagramImage.js';
import { Controller as listDiagramPins, ValidationSchema as listDiagramPinsValidationSchema } from '@/modules/customer-portal/diagram/controllers/listDiagramPins.js';
import { Controller as createDiagramPin, ValidationSchema as createDiagramPinValidationSchema } from '@/modules/customer-portal/diagram/controllers/createDiagramPin.js';
import { Controller as updateDiagramPin, ValidationSchema as updateDiagramPinValidationSchema } from '@/modules/customer-portal/diagram/controllers/updateDiagramPin.js';
import { Controller as deleteDiagramPin, ValidationSchema as deleteDiagramPinValidationSchema } from '@/modules/customer-portal/diagram/controllers/deleteDiagramPin.js';
import { Controller as listRecentDiagramImages } from '@/modules/customer-portal/diagram/controllers/listRecentDiagramImages.js';
import { Controller as createDiagramImageFromRecent, ValidationSchema as createDiagramImageFromRecentValidationSchema } from '@/modules/customer-portal/diagram/controllers/createDiagramImageFromRecent.js';

const router = Router();



router.get('/recent-images', requireCustomerAuth, withDatabase(listRecentDiagramImages));

router.route('/')
  .get(requireCustomerAuth, withDatabase(listDiagrams))
  .post(requireCustomerAuth, validate(createDiagramValidationSchema), withDatabase(createDiagram));

router.route('/:id/images')
  .get(requireCustomerAuth, validate(listDiagramImagesValidationSchema), withDatabase(listDiagramImages))
  .post(requireCustomerAuth, validate(createDiagramImageValidationSchema), withDatabase(createDiagramImage));

router.post(
  '/:id/images/from-recent',
  requireCustomerAuth,
  validate(createDiagramImageFromRecentValidationSchema),
  withDatabase(createDiagramImageFromRecent),
);

router.route('/:id/images/:image_id')
  .delete(requireCustomerAuth, validate(deleteDiagramImageValidationSchema), withDatabase(deleteDiagramImage));

router.route('/:id/pins')
  .get(requireCustomerAuth, validate(listDiagramPinsValidationSchema), withDatabase(listDiagramPins))
  .post(requireCustomerAuth, validate(createDiagramPinValidationSchema), withDatabase(createDiagramPin));

router.route('/:id/pins/:pin_id')
  .put(requireCustomerAuth, validate(updateDiagramPinValidationSchema), withDatabase(updateDiagramPin))
  .delete(requireCustomerAuth, validate(deleteDiagramPinValidationSchema), withDatabase(deleteDiagramPin));

router.route('/:id')
  .get(parseCustomer, validate(getDiagramValidationSchema), withDatabase(getDiagram))
  .put(requireCustomerAuth, validate(updateDiagramValidationSchema), withDatabase(updateDiagram))
  .delete(requireCustomerAuth, validate(deleteDiagramValidationSchema), withDatabase(deleteDiagram));

export default router;
