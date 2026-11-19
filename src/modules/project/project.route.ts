import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import { Controller as listProjects, ValidationSchema as listProjectsValidationSchema } from '@/modules/project/controllers/listProjects.js';
import { Controller as getProject, ValidationSchema as getProjectValidationSchema } from '@/modules/project/controllers/getProject.js';

const router = Router();

const projectAccess = permission('admin', 'support');

router.route('/')
  .get(projectAccess, validate(listProjectsValidationSchema), withDatabase(listProjects));

router.route('/:id')
  .get(projectAccess, validate(getProjectValidationSchema), withDatabase(getProject));

export default router;
