import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id: diagramId } = req.params as z.infer<typeof ValidationSchema.params>;

  const owned = await db.queryOne(
    'SELECT id FROM diagrams WHERE id = $1 AND created_by = $2',
    [diagramId, customerId],
  );

  if (!owned) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  const images = await db.queryAll(
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
    [diagramId],
  );

  return res.status(StatusCodes.OK).json(images);
}
