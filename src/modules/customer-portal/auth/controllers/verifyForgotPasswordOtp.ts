import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { decryptEncryptedToken } from '@/utility/token.js';
import RedisClient from '@/service/redis/index.js';

export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().min(1).max(5000),
    otp: z.string().trim().min(1).max(255),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token, otp } = req.body as z.infer<typeof ValidationSchema.body>;

  const decrypted = await decryptEncryptedToken<{ type: TokenTypes; customer_id: string } | null>(token);

  if (!decrypted || decrypted.type !== TokenTypes.CUSTOMER_PASSWORD_RESET_TOKEN) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid token' });
  }

  const storedOtp = await RedisClient.get(token);
  if (!storedOtp) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid or expired token' });
  }

  if (storedOtp !== otp) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid OTP' });
  }

  const customer = await db.queryOne(
    'SELECT id FROM users WHERE id = $1 AND role = \'customer\' AND is_deleted = false',
    [decrypted.customer_id],
  );
  if (!customer) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid or expired token' });
  }

  await RedisClient.set(token, '1', { EX: 10 * 60 });

  return res.status(StatusCodes.OK).json({
    message: 'OTP verified. You can set a new password.',
    token,
  });
}
