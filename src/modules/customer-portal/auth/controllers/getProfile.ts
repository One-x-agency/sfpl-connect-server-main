import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const customerId = req.user.id;

  const profile = await db.queryOne(
    `
      SELECT
        id,
        name,
        email,
        phone_number,
        created_at,
        updated_at,
        is_email_verified,
        is_phone_number_verified,
        login_method,
        CASE
          WHEN password_hash IS NULL OR password_hash = '' THEN false
          ELSE true
        END AS has_password,
        (
          SELECT COUNT(*) FROM notifications where user_id = $1 AND seen_at IS NULL
        ) AS unread_notifications_count
      FROM users
      WHERE id = $1 AND role = 'customer' AND is_deleted = false
    `,
    [customerId],
  );

  if (!profile) {
    return res.status(StatusCodes.NOT_FOUND).json({
      message: 'Customer not found',
    });
  }

  return res.status(StatusCodes.OK).json(profile);
}

