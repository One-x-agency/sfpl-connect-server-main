import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  query: z.object({
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
    device_id: Schema.uuid().optional(),
    from_date: z.coerce.date().optional(),
    to_date: z.coerce.date().optional(),
  }).refine(
    (data) => !(data.from_date && data.to_date) || data.from_date <= data.to_date,
    {
      message: 'from_date must be before to_date',
      path: ['from_date', 'to_date'],
    },
  ),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  void next;

  const { id: customer_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const {
    limit,
    offset,
    device_id,
    from_date,
    to_date,
  } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  let whereClause = `
    WHERE n.user_id = $customer_id
      AND n.type = 'custom_notification'
  `;

  if (device_id) whereClause += ' AND resolved.device_id = $device_id ';
  if (from_date) whereClause += ' AND n.created_at >= $from_date ';
  if (to_date) whereClause += ' AND n.created_at <= $to_date ';

  const alerts = await db.namedQueryAll(
    `
      SELECT
        n.id,
        n.user_id,
        n.type,
        n.title,
        n.body,
        n.data,
        n.meta_data,
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
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $limit
      OFFSET $offset
    `,
    {
      customer_id,
      device_id,
      from_date,
      to_date,
      limit,
      offset,
    },
  );

  return res.status(StatusCodes.OK).json(alerts);
}

