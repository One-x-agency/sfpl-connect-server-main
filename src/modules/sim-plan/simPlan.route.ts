import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import { Controller as createSimPlan, ValidationSchema as createSimPlanValidationSchema } from './controllers/createSimPlan.js';
import { Controller as listSimPlans, ValidationSchema as listSimPlansValidationSchema } from './controllers/listSimPlans.js';
import { Controller as getSimPlan, ValidationSchema as getSimPlanValidationSchema } from './controllers/getSimPlan.js';
import { Controller as updateSimPlan, ValidationSchema as updateSimPlanValidationSchema } from './controllers/updateSimPlan.js';
import { Controller as deleteSimPlan, ValidationSchema as deleteSimPlanValidationSchema } from './controllers/deleteSimPlan.js';

const router = Router();

const simPlanReaders = permission('admin', 'qc', 'accountant');
const simPlanAdmins = permission('admin');

router.route('/')
  .post(simPlanAdmins, validate(createSimPlanValidationSchema), withDatabase(createSimPlan))
  .get(simPlanReaders, validate(listSimPlansValidationSchema), withDatabase(listSimPlans));

router.route('/:sim_plan_id')
  .get(simPlanReaders, validate(getSimPlanValidationSchema), withDatabase(getSimPlan))
  .put(simPlanAdmins, validate(updateSimPlanValidationSchema), withDatabase(updateSimPlan))
  .delete(simPlanAdmins, validate(deleteSimPlanValidationSchema), withDatabase(deleteSimPlan));

export default router;
