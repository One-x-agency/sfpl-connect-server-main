import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { createJWTToken, decryptEncryptedToken } from '@/utility/token.js';

export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().min(1).max(5000),
    password: z.string().trim().min(5, 'password must be at least 5 characters').max(255, 'Password must be less than 255 characters'),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token, password } = req.body as z.infer<typeof ValidationSchema.body>;

  const decrypted = await decryptEncryptedToken<{ type: TokenTypes; user_id: string } | null>(token);

  if (!decrypted || decrypted.type !== TokenTypes.USER_PASSWORD_RESET_TOKEN) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid token' });
  }

  const { user_id: userId } = decrypted;

  const user = await db.queryOne('SELECT id, name, email FROM users WHERE id = $1', [userId]);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid or expired token' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.queryOne(
    'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name, email',
    [passwordHash, userId],
  );

  const accessToken = await createJWTToken(
    {
      type: TokenTypes.USER_ACCESS_TOKEN,
      user_id: userId,
    },
    '1h',
  );

  return res.status(StatusCodes.OK).json({
    token: accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}

