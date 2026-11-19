import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { updateCustomNotification } from '@/modules/customer-portal/custom-notification/services/Operation.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    name: z.string().trim().max(255).optional(),
    description: z.string().trim().nullish().optional(),
    input_field_id: Schema.uuid().optional(),
    operator: z.enum(['<', '<=', '=', '>=', '!=', '>']).optional(),
    value: z.number().optional(),
    send_to_email: z.boolean().default(false).optional(),
    send_to_sms: z.boolean().default(false).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const {
    name, description, input_field_id, operator, value, send_to_email, send_to_sms,
  } = req.body as z.infer<typeof ValidationSchema.body>;

  const updatedCustomNotification = await updateCustomNotification(
    { database: db },
    id,
    {
      name,
      description: description ?? null,
      input_field_id,
      operator,
      value,
      send_to_email,
      send_to_sms,
    },
  );

  return res.status(StatusCodes.OK).json(updatedCustomNotification);
}
