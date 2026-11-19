import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const notification = await db.queryOne(
    `
      SELECT
        cns.id,
        cns.name,
        cns.description,
        cns.input_field_id,
        cns.operator,
        cns.value,
        cns.send_to_email,
        cns.send_to_sms,
        cns.created_at,
        cns.updated_at
      FROM custom_notification_schemas cns
      WHERE cns.id = $1
    `,
    [id],
  );

  if (!notification) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Custom notification not found' });
  }

  return res.status(StatusCodes.OK).json(notification);
}

