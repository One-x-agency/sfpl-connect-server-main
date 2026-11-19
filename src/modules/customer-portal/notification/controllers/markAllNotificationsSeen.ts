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

  const result = await db.queryOne(
    `
      WITH updated AS (
        UPDATE notifications
        SET seen_at = now()
        WHERE user_id = $1
          AND seen_at IS NULL
        RETURNING id
      )
      SELECT COUNT(*)::int AS updated_count
      FROM updated
    `,
    [customerId],
  );

  return res.status(StatusCodes.OK).json({
    success: true,
    updated_count: result?.updated_count ?? 0,
    seen_at: new Date().toISOString(),
  });
}

