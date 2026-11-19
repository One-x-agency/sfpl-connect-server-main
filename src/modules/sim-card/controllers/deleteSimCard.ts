import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { deleteSimCard } from '@/modules/sim-card/services/operations.service.js';

export const ValidationSchema = {
  params: z.object({
    sim_card_id: z.uuid({ version: 'v7', message: 'Invalid sim card id' }),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { sim_card_id } = req.params as z.infer<typeof ValidationSchema.params>;

  await deleteSimCard({ database: db }, sim_card_id);

  return res.status(StatusCodes.SUCCESS).send();
}
