import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;

  const rows = await db.queryAll(
    `
      WITH scope AS (
        SELECT
          di.id,
          di.diagram_id,
          di.file_id,
          di.original_image_id,
          di.created_at,
          f.key AS file_key,
          f.endpoint AS file_endpoint
        FROM diagram_images di
        INNER JOIN diagrams d ON d.id = di.diagram_id AND d.created_by = $1
        LEFT JOIN files f ON f.id = di.file_id
      ),
      last_use AS (
        SELECT original_image_id, MAX(created_at) AS last_used_at
        FROM scope
        GROUP BY original_image_id
      ),
      picked AS (
        SELECT DISTINCT ON (s.original_image_id)
          s.id,
          s.diagram_id,
          s.file_id,
          s.original_image_id,
          s.created_at,
          s.file_key,
          s.file_endpoint
        FROM scope s
        ORDER BY
          s.original_image_id,
          (s.id = s.original_image_id) DESC,
          s.created_at ASC
      )
      SELECT
        p.id,
        p.diagram_id,
        p.file_id,
        p.original_image_id,
        p.file_key,
        p.file_endpoint,
        l.last_used_at
      FROM picked p
      INNER JOIN last_use l ON l.original_image_id = p.original_image_id
      ORDER BY l.last_used_at DESC
      LIMIT 48
    `,
    [customerId],
  );

  return res.status(StatusCodes.OK).json(rows);
}
