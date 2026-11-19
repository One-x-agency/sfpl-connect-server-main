import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createDiagram } from '@/modules/customer-portal/diagram/diagram.service.js';

const configSchema = z.record(z.string(), z.any()).default({});

export const ValidationSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(500),
    config: configSchema.optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { name, config } = req.body as z.infer<typeof ValidationSchema.body>;

  const diagram = await createDiagram(
    { database: db },
    {
      name,
      config: config ?? {},
      created_by: customerId,
    },
  );

  return res.status(StatusCodes.OK).json(diagram);
}
