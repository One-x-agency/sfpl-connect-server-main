import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { createJWTToken } from '@/utility/token.js';
import Schema from '@/config/validationSchema.js';
import { setCustomerAuthCookies } from '@/utility/customerAuthCookies.js';
import { mergeGuestCartIntoCustomer } from '@/modules/customer-portal/store/services/cart.service.js';
import Logger from '@/service/logger/index.js';

export const ValidationSchema = {
  body: z.object({
    email: Schema.email(),
    password: z.string().trim().min(1, 'Password is required').max(255, 'Password must be less than 255 characters'),
    guest_cart_id: z.uuid({ version: 'v7' }).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { email, password, guest_cart_id } = req.body as z.infer<typeof ValidationSchema.body>;



  const customer = await db.queryOne(
    'SELECT * FROM users WHERE email = $1 AND role = \'customer\'',
    [email],
  );
  if (!customer) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid email or password' });

  if (customer.is_deleted) {
    return res.status(StatusCodes.FORBIDDEN).json({ code : 'ACCOUNT_DELETED', message: 'account has been deleted please contact support' });
  }

  if (!customer.password_hash) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'You are logged in with Google. Please use Google to login.' });
  }

  const isPasswordValid = await bcrypt.compare(password, customer.password_hash);
  if (!isPasswordValid) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid email or password' });

  // Best-effort: adopt the guest cart into the customer cart on login.
  if (guest_cart_id) {
    try {
      await mergeGuestCartIntoCustomer(db, guest_cart_id, customer.id);
    } catch (error) {
      Logger.error(`Failed to merge guest cart ${guest_cart_id} on login`, error);
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
