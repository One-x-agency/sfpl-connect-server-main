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

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const customerId = req.user.id;

  const notification = await db.queryOne(
    `
      UPDATE notifications
      SET seen_at = NULL
      WHERE id = $1
        AND user_id = $2
      RETURNING id, seen_at
    `,
    [id, customerId],
  );

  if (!notification) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Notification not found' });
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    notification,
  });
}

