import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const customerId = req.user.id;

  const notifications = await db.queryAll(
    `
      SELECT
        n.id,
        n.type,
        n.user_id,
        n.title,
        n.body,
        n.data,
        n.meta_data,
        n.seen_at,
        n.created_at,
        resolved.device_id,
        d.name AS device_name,
        d.imei AS device_imei,
        resolved.input_field_id,
        dif.io_pin AS input_field_io_pin,
        dif.name AS input_field_name
      FROM notifications n
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(n.data->>'device_id', n.meta_data->>'device_id')::uuid AS device_id,
          COALESCE(n.data->>'input_field_id', n.meta_data->>'input_field_id')::uuid AS input_field_id
      ) resolved ON TRUE
      LEFT JOIN devices d ON resolved.device_id = d.id
      LEFT JOIN device_input_fields dif ON resolved.input_field_id = dif.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
    `,
    [customerId],
  );

  return res.status(StatusCodes.OK).json(notifications);
}

