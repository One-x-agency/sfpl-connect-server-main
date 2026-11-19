import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { updateDiagram } from '@/modules/customer-portal/diagram/diagram.service.js';

const configSchema = z.record(z.string(), z.any());

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(500).optional(),
    config: configSchema.optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { name, config } = req.body as z.infer<typeof ValidationSchema.body>;

  const updated = await updateDiagram(
    { database: db },
    id,
    customerId,
    { name, config },
  );

  if (!updated) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  return res.status(StatusCodes.SUCCESS).send();
}
