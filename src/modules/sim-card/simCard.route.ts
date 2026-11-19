import { Router } from 'express';

import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import { Controller as createSimCard, ValidationSchema as createSimCardValidationSchema } from './controllers/createSimCard.js';
import { Controller as listSimCards, ValidationSchema as listSimCardsValidationSchema } from './controllers/listSimCards.js';
import { Controller as getSimCard, ValidationSchema as getSimCardValidationSchema } from './controllers/getSimCard.js';
import { Controller as updateSimCard, ValidationSchema as updateSimCardValidationSchema } from './controllers/updateSimCard.js';
import { Controller as deleteSimCard, ValidationSchema as deleteSimCardValidationSchema } from './controllers/deleteSimCard.js';

const router = Router();

const simReaders = permission('admin', 'qc', 'accountant');
const simCreators = permission('admin', 'qc');
const simEditors = permission('admin', 'accountant');
const simAdmins = permission('admin');

router.route('/')
  .post(simCreators, validate(createSimCardValidationSchema), withDatabase(createSimCard))
  .get(simReaders, validate(listSimCardsValidationSchema), withDatabase(listSimCards));

router.route('/:sim_card_id')
  .get(simReaders, validate(getSimCardValidationSchema), withDatabase(getSimCard))
  .put(simEditors, validate(updateSimCardValidationSchema), withDatabase(updateSimCard))
  .delete(simAdmins, validate(deleteSimCardValidationSchema), withDatabase(deleteSimCard));

export default router;
