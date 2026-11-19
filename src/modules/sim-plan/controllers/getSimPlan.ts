import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { getSimPlan } from '@/modules/sim-plan/services/operations.service.js';

export const ValidationSchema = {
  params: z.object({
    sim_plan_id: z.uuid({ version: 'v7', message: 'Invalid sim plan id' }),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { sim_plan_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const simPlan = await getSimPlan({ database: db }, sim_plan_id);

  return res.status(StatusCodes.OK).json(simPlan);
}
