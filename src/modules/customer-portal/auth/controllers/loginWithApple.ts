import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { verifyAppleToken } from '@/etc/appleAuth.js';
import { createJWTToken } from '@/utility/token.js';
import { TokenTypes } from '@/config/constant.js';
import { setCustomerAuthCookies } from '@/utility/customerAuthCookies.js';
import { createDefaultDashboardMetadata } from '@/modules/user/dashboardPreferences.defaults.js';

export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().nonempty().max(5000),
    name: z.string().trim().max(200).nullish(),
  })
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token, name } = req.body as z.infer<typeof ValidationSchema.body>;

  const payload = await verifyAppleToken(token);
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (!email) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid Apple token' });
  }

  let customer = await db.queryOne(`
    SELECT id, name, email, is_email_verified, created_at, is_deleted
    FROM users
    WHERE email = $1 AND role = 'customer'
  `, [email]);

  if (customer && customer.is_deleted) {
    return res.status(StatusCodes.FORBIDDEN).json({ code : 'ACCOUNT_DELETED', message: 'account has been deleted please contact support' });
  }

  if (!customer) {
    const metadata = createDefaultDashboardMetadata();
    customer = await db.queryOne(`
      INSERT INTO users (name, email, is_email_verified, login_method, role, metadata)
      VALUES ($1, $2, true, 'apple_auth', 'customer', $3::jsonb)
      RETURNING *
    `, [name ?? email.split('@')[0], email, JSON.stringify(metadata)]);
  }

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
