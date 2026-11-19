import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    device_id: Schema.uuid().optional(),
    project_id: Schema.uuid().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { device_id, project_id } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
  const customer_id = req.user.id;

  const notifications = await db.namedQueryAll(
    `
      SELECT
        cns.id,
        cns.name,
        cns.description,
        cns.input_field_id,
        dif.name AS input_field_name,
        d.name AS device_name,
        d.imei AS device_imei,
        cns.operator,
        cns.value,
        cns.send_to_email,
        cns.send_to_sms,
        cns.created_at,
        cns.updated_at
      FROM custom_notification_schemas cns
      JOIN device_input_fields dif ON dif.id = cns.input_field_id
      JOIN devices d ON d.id = dif.device_id
      WHERE d.user_id = $customer_id
        AND ($device_id::uuid IS NULL OR dif.device_id = $device_id)
        AND ($project_id::uuid IS NULL OR d.project_id = $project_id)
      ORDER BY cns.created_at DESC
    `,
    {
      customer_id,
      device_id: device_id ?? null,
      project_id: project_id ?? null,
    },
  );

  return res.status(StatusCodes.OK).json(notifications);
}

