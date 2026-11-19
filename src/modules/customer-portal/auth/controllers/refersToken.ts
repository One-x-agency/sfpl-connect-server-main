import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { createJWTToken, decodeJWTToken } from '@/utility/token.js';
import { setCustomerAuthCookies } from '@/utility/customerAuthCookies.js';

export const ValidationSchema = {
  body: z.object({
    refresh_token: z.string().trim().min(1).max(5000),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { refresh_token } = req.body as z.infer<typeof ValidationSchema.body>;

  const decoded = await decodeJWTToken<{ type: TokenTypes, customer_id: string } | null>(refresh_token);
  if (!decoded || decoded.type !== TokenTypes.CUSTOMER_REFRESH_TOKEN) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid refresh token' });

  const customer = await db.queryOne(
    'SELECT id, name, email FROM users WHERE id = $1 AND role = \'customer\' AND is_deleted = false',
    [decoded.customer_id],
  );
  if (!customer) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid refresh token' });

  const accessToken = await createJWTToken({ type: TokenTypes.CUSTOMER_ACCESS_TOKEN, customer_id: customer.id }, '1h');
  const refreshToken = await createJWTToken({ type: TokenTypes.CUSTOMER_REFRESH_TOKEN, customer_id: customer.id }, '7d');

  setCustomerAuthCookies(res, {
    accessToken,
    refreshToken,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
    },
  });

  return res.status(StatusCodes.OK).json({ token: accessToken, refresh_token: refreshToken, user: { id: customer.id, name: customer.name, email: customer.email } });
}
