import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import env from '@/config/env.js';
import { createJWTToken } from '@/utility/token.js';
import { TokenTypes, HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { setCustomerAuthCookies } from '@/utility/customerAuthCookies.js';
import { createDefaultDashboardMetadata } from '@/modules/user/dashboardPreferences.defaults.js';
import { mergeGuestCartIntoCustomer } from '@/modules/customer-portal/store/services/cart.service.js';
import Logger from '@/service/logger/index.js';

const client = new OAuth2Client();


export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().nonempty().max(5000),
    guest_cart_id: z.uuid({ version: 'v7' }).optional(),
  })
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token, guest_cart_id } = req.body as z.infer<typeof ValidationSchema.body>;

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: [
      env.google.webClientId,
      env.google.androidClientId,
      env.google.iosClientId,
    ],
  });

  const payload = ticket.getPayload();

  const googleEmail = payload?.email?.trim();
  if (!googleEmail) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid Google token' });
  }


  let customer = await db.queryOne(`
    SELECT id, name, email, is_email_verified, created_at, is_deleted
    FROM users
    WHERE email = $1 AND role = 'customer'
    `, [googleEmail]);

  if (customer && customer.is_deleted) {
    return res.status(StatusCodes.FORBIDDEN).json({ code : 'ACCOUNT_DELETED', message: 'account has been deleted please contact support' });
  }

  if (!customer) {
    const metadata = createDefaultDashboardMetadata();
    customer = await db.queryOne(`
      INSERT INTO users (name, email, is_email_verified, login_method, role, metadata)
      VALUES ($1, $2, true, 'google_auth', 'customer', $3::jsonb)
      RETURNING *
    `, [payload.name ?? googleEmail.split('@')[0], googleEmail, JSON.stringify(metadata)]);
  }

  // Best-effort: adopt the guest cart into the customer cart on login.
  if (guest_cart_id) {
    try {
      await mergeGuestCartIntoCustomer(db, guest_cart_id, customer.id);
    } catch (error) {
      Logger.error(`Failed to merge guest cart ${guest_cart_id} on google login`, error);
    }
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
