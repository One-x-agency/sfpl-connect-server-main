import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import z from 'zod';
import RedisClient from '@/service/redis/index.js';
import { createJWTToken, decryptEncryptedToken } from '@/utility/token.js';
import bcrypt from 'bcryptjs';
import { TokenTypes } from '@/config/constant.js';
import { setCustomerAuthCookies } from '@/utility/customerAuthCookies.js';
import { createDefaultDashboardMetadata } from '@/modules/user/dashboardPreferences.defaults.js';
import { mergeGuestCartIntoCustomer } from '@/modules/customer-portal/store/services/cart.service.js';
import Logger from '@/service/logger/index.js';

export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().min(1).max(5000),
    otp: z.string().trim().min(1).max(255),
    guest_cart_id: z.uuid({ version: 'v7' }).optional(),
  }),
};


export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token, otp, guest_cart_id } = req.body as z.infer<typeof ValidationSchema.body>;

  const decryptedToken = await decryptEncryptedToken(token) as { type: TokenTypes, name: string, email: string, phone_number?: string, password: string };
  if (!decryptedToken || decryptedToken.type !== TokenTypes.CUSTOMER_REGISTRATION_TOKEN) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid token' });

  const storedOtp = await RedisClient.get(token);
  if (!storedOtp) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid or expired token' });

  if (storedOtp !== otp) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid OTP' });

  const {
    name, email, password, phone_number
  } = decryptedToken;

  const passwordHash = await bcrypt.hash(password, 10);
  const metadata = createDefaultDashboardMetadata();

  const newCustomer = await db.queryOne(`
    INSERT INTO users (role, name, email, phone_number, password_hash, is_email_verified, metadata)
    VALUES ('customer', $1, $2, $3, $4, TRUE, $5::jsonb)
    RETURNING *
  `, [name, email, phone_number, passwordHash, JSON.stringify(metadata)]);

  // Best-effort: adopt the guest cart into the new customer cart.
  if (guest_cart_id) {
    try {
      await mergeGuestCartIntoCustomer(db, guest_cart_id, newCustomer.id);
    } catch (error) {
      Logger.error(`Failed to merge guest cart ${guest_cart_id} on registration`, error);
    }
  }

  const accessToken = await createJWTToken({ type: TokenTypes.CUSTOMER_ACCESS_TOKEN, customer_id: newCustomer.id }, '1h');
  const refreshToken = await createJWTToken({ type: TokenTypes.CUSTOMER_REFRESH_TOKEN, customer_id: newCustomer.id }, '7d');

  setCustomerAuthCookies(res, {
    accessToken,
    refreshToken,
    user: {
      id: newCustomer.id,
      name: newCustomer.name,
      email: newCustomer.email,
    },
  });

  return res.status(StatusCodes.OK).json({
    token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: newCustomer.id,
      name: newCustomer.name,
      email: newCustomer.email,
    },
  });
}
