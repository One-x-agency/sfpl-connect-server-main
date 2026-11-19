import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { deleteDiagram } from '@/modules/customer-portal/diagram/diagram.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const deleted = await deleteDiagram({ database: db }, id, customerId);

  if (!deleted) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  return res.status(StatusCodes.SUCCESS).send();
}
