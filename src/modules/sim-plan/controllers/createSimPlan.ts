import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createSimPlan } from '@/modules/sim-plan/services/operations.service.js';

export const ValidationSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(255),
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
  const {
    name,
    sms_limit,
    data_limit,
    call_limit,
    subscription_amount,
    remark,
  } = req.body as z.infer<typeof ValidationSchema.body>;

  const simPlan = await createSimPlan(
    { database: db },
    {
      name,
      sms_limit,
      data_limit,
      call_limit,
      subscription_amount,
      remark,
      created_by: req.user.id,
    },
  );

  return res.status(StatusCodes.OK).json(simPlan);
}
