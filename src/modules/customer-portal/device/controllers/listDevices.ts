import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    project_id: Schema.uuid().optional(),
    user_id: Schema.uuid().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { project_id, user_id } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
  const customerId = user_id ?? req.user.id;

  const params: any[] = [];
  const conditions: string[] = [];

  if (customerId) {
    params.push(customerId);
    conditions.push(`user_id = $${params.length}`);
  }

  if (project_id) {
    params.push(project_id);
    conditions.push(`project_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const devices = await db.queryAll(
    `
    WITH filtered_devices AS (
      SELECT
        id,
        imei,
        project_id,
        name,
        description,
        latitude,
        longitude,
        user_id,
        created_at
      FROM devices
      ${whereClause}
      ORDER BY created_at DESC
    )

    SELECT
      d.*,
      CASE WHEN dl.device_id IS NOT NULL THEN
        json_build_object(
          'timestamp', dl.timestamp,
          'status', dl.status,
          'data', dl.data
        )
      ELSE NULL END AS last_record,

      CASE
        WHEN dl.device_id IS NOT NULL AND dl.timestamp >= NOW() - INTERVAL '10 minutes' THEN dl.status
        ELSE 'inactive'
      END AS status


    FROM filtered_devices d
    LEFT JOIN LATERAL (
      SELECT
        device_id,
        timestamp,
        status,
        data,
        created_at
      FROM device_logs
      WHERE device_id = d.id
      ORDER BY timestamp DESC, created_at DESC
      LIMIT 1
    ) dl ON dl.device_id = d.id
    `,
    params,
  );

  return res.status(StatusCodes.OK).json(devices);
}
