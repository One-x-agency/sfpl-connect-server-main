import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { updateSimPlan } from '@/modules/sim-plan/services/operations.service.js';

export const ValidationSchema = {
  params: z.object({
    sim_plan_id: z.uuid({ version: 'v7', message: 'Invalid sim plan id' }),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(255).optional(),
    sms_limit: z.number().min(0).optional(),
    data_limit: z.number().min(0).optional(),
    call_limit: z.number().min(0).optional(),
    subscription_amount: z.number().min(0).optional(),
    remark: z.string().trim().nullable().optional(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { sim_plan_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const body = req.body as z.infer<typeof ValidationSchema.body>;

  await updateSimPlan(
    { database: db },
    sim_plan_id,
    { ...body, updated_by: req.user.id },
  );

  return res.status(StatusCodes.SUCCESS).send();
}
