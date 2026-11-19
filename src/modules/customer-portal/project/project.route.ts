import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import validate from '@/middleware/requestValidator.js';

import { Controller as listProjects } from '@/modules/customer-portal/project/controllers/listProjects.js';
import { Controller as createProject, ValidationSchema as createProjectValidationSchema } from '@/modules/customer-portal/project/controllers/createProject.js';
import { Controller as getProject, ValidationSchema as getProjectValidationSchema } from '@/modules/customer-portal/project/controllers/getProject.js';
import { Controller as updateProject, ValidationSchema as updateProjectValidationSchema } from '@/modules/customer-portal/project/controllers/updateProject.js';
import { Controller as deleteProject, ValidationSchema as deleteProjectValidationSchema } from '@/modules/customer-portal/project/controllers/deleteProject.js';

const router = Router();

router.use(requireCustomerAuth);

router.route('/')
  .get(withDatabase(listProjects))
  .post(validate(createProjectValidationSchema), withDatabase(createProject));

router.route('/:id')
  .get(validate(getProjectValidationSchema), withDatabase(getProject))
  .put(validate(updateProjectValidationSchema), withDatabase(updateProject))
  .delete(validate(deleteProjectValidationSchema), withDatabase(deleteProject));

export default router;
