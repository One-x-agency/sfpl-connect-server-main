import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { createJWTToken, decryptEncryptedToken } from '@/utility/token.js';
import RedisClient from '@/service/redis/index.js';

export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().min(1).max(5000),
    password: z.string().trim().min(5, 'password must be at least 5 characters').max(255, 'Password must be less than 255 characters'),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token, password } = req.body as z.infer<typeof ValidationSchema.body>;

  const decrypted = await decryptEncryptedToken<{ type: TokenTypes; customer_id: string } | null>(token);

  if (!decrypted || decrypted.type !== TokenTypes.CUSTOMER_PASSWORD_RESET_TOKEN) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid token' });
  }

  const redisMarker = await RedisClient.get(token);
  if (!redisMarker || redisMarker !== '1') {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid or expired token' });
  }

  const { customer_id: customerId } = decrypted;

  const customer = await db.queryOne(
    'SELECT id, name, email FROM users WHERE id = $1 AND role = \'customer\' AND is_deleted = false',
    [customerId],
  );
  if (!customer) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid or expired token' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const updatedCustomer = await db.queryOne(
    'UPDATE users SET password_hash = $1 WHERE id = $2 AND role = \'customer\' AND is_deleted = false RETURNING id, name, email',
    [passwordHash, customerId],
  );

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const accessToken = await createJWTToken(
    {
      type: TokenTypes.CUSTOMER_ACCESS_TOKEN,
      customer_id: customerId,
    },
    expiresAt,
  );

  return res.status(StatusCodes.OK).json({
    token: accessToken,
    user: {
      id: updatedCustomer.id,
      name: updatedCustomer.name,
      email: updatedCustomer.email,
    },
    expires_at: expiresAt.toISOString(),
  });
}

