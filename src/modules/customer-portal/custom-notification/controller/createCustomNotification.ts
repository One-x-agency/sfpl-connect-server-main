import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

import Schema from '@/config/validationSchema.js';
import { createCustomNotification } from '@/modules/customer-portal/custom-notification/services/Operation.service.js';

export const ValidationSchema = {
  body: z.object({
    name: z.string().trim().max(255),
    description: z.string().trim().nullish().optional(),
    input_field_id: Schema.uuid(),
    operator: z.enum(['<', '<=', '=', '>=', '!=', '>']),
    value: z.number(),
    send_to_email: z.boolean().default(false),
    send_to_sms: z.boolean().default(false),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const {
    name, description, input_field_id, operator, value, send_to_email, send_to_sms
  } = req.body as z.infer<typeof ValidationSchema.body>;

  const deviceInputField = await db.queryOne('SELECT id FROM device_input_fields WHERE id = $1', [input_field_id]);
  if (!deviceInputField) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device input field not found' });

  const customNotification = await createCustomNotification(
    { database: db },
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

  return res.status(StatusCodes.OK).json(customNotification);
}
