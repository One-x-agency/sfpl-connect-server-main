import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import { updateSimCard } from '@/modules/sim-card/services/operations.service.js';

export const ValidationSchema = {
  params: z.object({
    sim_card_id: z.uuid({ version: 'v7', message: 'Invalid sim card id' }),
  }),

  body: z.object({
    number: z.string().trim().max(255).optional(),
    is_active: z.boolean().optional(),
    sim_plan_id: z.uuid({ version: 'v7', message: 'Invalid sim plan id' }).optional(),
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
  const { sim_card_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  let updatePayload: z.infer<typeof ValidationSchema.body> & { updated_by: string };

  if (req.user.role === 'accountant') {
    const allowedKeys = ['is_active'] as const;
    const extraKeys = Object.keys(body).filter(
      (key) => !allowedKeys.includes(key as typeof allowedKeys[number]),
    );
    if (extraKeys.length > 0) {
      throw new ServerError('Accountants can only update SIM active status');
    }
    if (body.is_active === undefined) {
      throw new ServerError('is_active is required');
    }

    updatePayload = {
      is_active: body.is_active,
      updated_by: req.user.id,
    };

    if (!body.is_active) {
      updatePayload.deactivation_date = new Date();
    }
  } else {
    updatePayload = {
      ...body,
      updated_by: req.user.id,
    };
  }

  await updateSimCard(
    { database: db },
    sim_card_id,
    updatePayload,
  );

  return res.status(StatusCodes.SUCCESS).send();
}
