import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { deleteDiagramPin } from '@/modules/customer-portal/diagram/diagram.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
    pin_id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id: diagramId, pin_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const deleted = await deleteDiagramPin(
    { database: db },
    pin_id,
    diagramId,
    customerId,
  );

  if (!deleted) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram pin not found' });

  return res.status(StatusCodes.SUCCESS).send();
}
