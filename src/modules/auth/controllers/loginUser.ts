import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { createJWTToken } from '@/utility/token.js';
import Schema from '@/config/validationSchema.js';
import { STAFF_ROLES } from '@/constants/user-role.js';
import { logActivity, getActivityActorFromRequest } from '@/modules/activity-log/services/activity-log.service.js';

export const ValidationSchema = {
  body: z.object({
    email: Schema.email(),
    password: z.string().trim().min(1, 'Password is required').max(255, 'Password must be less than 255 characters'),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { email, password } = req.body as z.infer<typeof ValidationSchema.body>;

  const user = await db.queryOne(
    'SELECT * FROM users WHERE email = $1 AND role = ANY($2::user_role[]) AND is_deleted = false AND is_active = true',
    [email, STAFF_ROLES],
  );
  if (!user) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid email or password' });

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid email or password' });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const accessToken = await createJWTToken({ type: TokenTypes.USER_ACCESS_TOKEN, user_id: user.id }, expiresAt);

  await logActivity(db, {
    ...getActivityActorFromRequest(req),
    userId: user.id,
    module: 'users',
    action: 'login',
    entityId: user.id,
    entityLabel: user.name,
    metadata: {
      email: user.email,
      role: user.role,
    },
  });

  return res.status(StatusCodes.OK).json({
    token: accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    expires_at: expiresAt.toISOString(),
  });
}
