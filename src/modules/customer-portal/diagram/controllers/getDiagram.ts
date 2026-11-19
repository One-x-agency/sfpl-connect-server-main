import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { decodeJWTToken } from '@/utility/token.js';
import logger from '@/service/logger/index.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  query: z.object({
    access_token: z.string().trim().min(1).max(2000).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { access_token } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  let customerId: string | undefined;

  if (access_token) {
    const decoded = await decodeJWTToken<{ type: string; user_id?: string }>(access_token);
    if (decoded?.type !== 'diagram_access_token' || !decoded.user_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid access token' });
    }
    customerId = decoded.user_id;
  } else {
    customerId = req.user?.id;
  }

  if (!customerId) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });

  const diagram = await db.queryOne(
    `
      SELECT
        id,
        name,
        config,
        created_by,
        created_at,
        updated_at
      FROM diagrams
      WHERE id = $1
        AND created_by = $2
    `,
    [id, customerId],
  );

  if (!diagram) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  const [images, pins] = await Promise.all([
    db.queryAll(
      `
        SELECT
          di.id,
          di.diagram_id,
          di.file_id,
          di.original_image_id,
          di.config,
          di.created_by,
          di.created_at,
          f.key AS file_key,
          f.endpoint AS file_endpoint
        FROM diagram_images di
        LEFT JOIN files f ON f.id = di.file_id
        WHERE di.diagram_id = $1
        ORDER BY di.created_at ASC
      `,
      [id],
    ),
    db.queryAll(
      `
        SELECT
          dp.id,
          dp.diagram_id,
          dp.input_field_id,
          (dp.config->>'x')::numeric AS x,
          (dp.config->>'y')::numeric AS y,
          dp.config,
          dif.name AS input_field_name,
          d.name AS device_name,
          d.imei AS device_imei,
          dl.timestamp,
          dl.status,
          dl.data->dp.input_field_id::text AS data
        FROM diagram_pins dp
        LEFT JOIN device_input_fields dif ON dif.id = dp.input_field_id
        LEFT JOIN devices d ON d.id = dif.device_id
        LEFT JOIN LATERAL (
          SELECT
            device_id,
            timestamp,
            status,
            data,
            created_at
          FROM device_logs
          WHERE device_id = d.id
            AND data ? dp.input_field_id::text
            AND timestamp <= NOW()
          ORDER BY timestamp DESC, created_at DESC
          LIMIT 1
        ) dl ON true
        WHERE dp.diagram_id = $1
        ORDER BY dp.id ASC
      `,
      [id],
    ),
  ]);



  return res.status(StatusCodes.OK).json({
    ...diagram,
    images,
    pins,
  });
}
