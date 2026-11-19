import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { createJWTToken } from '@/utility/token.js';
import { setCustomerAuthCookies } from '@/utility/customerAuthCookies.js';

export const ValidationSchema = {
  body: z.object({
    old_password: z.string().trim().min(1).max(255),
    new_password: z.string().trim().min(5, 'password must be at least 5 characters').max(255, 'Password must be less than 255 characters'),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  void next;

  const customerId = req.user!.id;
  const { old_password, new_password } = req.body as z.infer<typeof ValidationSchema.body>;

  const customer = await db.queryOne(
    'SELECT id, name, email, password_hash FROM users WHERE id = $1 AND role = \'customer\' AND is_deleted = false',
    [customerId],
  );

  if (!customer) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });

  if (!customer.password_hash) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: 'You are logged in with Google. Please use Google to login.' });
  }

  const isOldPasswordValid = await bcrypt.compare(old_password, customer.password_hash);
  if (!isOldPasswordValid) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid old password' });
  }

  const passwordHash = await bcrypt.hash(new_password, 10);

  await db.queryOne(
    'UPDATE users SET password_hash = $1 WHERE id = $2 AND role = \'customer\' AND is_deleted = false',
    [passwordHash, customerId],
  );

  const accessToken = await createJWTToken(
    { type: TokenTypes.CUSTOMER_ACCESS_TOKEN, customer_id: customerId },
    '1h',
  );
  const refreshToken = await createJWTToken(
    { type: TokenTypes.CUSTOMER_REFRESH_TOKEN, customer_id: customerId },
    '7d',
  );

  setCustomerAuthCookies(res, {
    accessToken,
    refreshToken,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
    },
  });

  return res.status(StatusCodes.OK).json({
    token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
    },
  });
}

