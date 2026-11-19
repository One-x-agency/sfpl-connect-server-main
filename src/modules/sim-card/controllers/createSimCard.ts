import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createSimCard } from '@/modules/sim-card/services/operations.service.js';

export const ValidationSchema = {
  body: z.object({
    number: z.string().trim().max(255),
    is_active: z.boolean().default(false),
    sim_plan_id: z.uuid({ version: 'v7', message: 'Invalid sim plan id' }),
    imsi_number: z.string().trim().max(50).nullable().optional(),
    activation_date: z.coerce.date().nullable().optional(),
    deactivation_date: z.coerce.date().nullable().optional(),
    expiry_date: z.coerce.date().nullable().optional(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const simCard = await createSimCard(
    { database: db },
    {
      ...body,
      created_by: req.user.id,
    },
  );

  return res.status(StatusCodes.OK).json(simCard);
}
