import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import z from 'zod';

export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().min(1).max(2000),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token } = req.body;
  const user_id = req.user.id;

  const notificationToken = await db.queryOne(`
    INSERT INTO notification_tokens (user_id, token)
    VALUES ($1, $2)
    ON CONFLICT (user_id, token)
    DO NOTHING
    RETURNING *
  `, [user_id, token]);

  return res.status(StatusCodes.OK).json(notificationToken);
}
