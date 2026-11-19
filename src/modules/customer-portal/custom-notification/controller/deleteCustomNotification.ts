import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { deleteCustomNotification } from '@/modules/customer-portal/custom-notification/services/Operation.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  await deleteCustomNotification(
    { database: db },
    id,
  );

  return res.status(StatusCodes.SUCCESS).send();
}

