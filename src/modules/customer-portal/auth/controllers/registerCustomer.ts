import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { createEncryptedToken } from '@/utility/token.js';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import RedisClient from '@/service/redis/index.js';
import z from 'zod';
import emailVerifyOtp from '@/utility/emailTemplates/emailVerifyOtp.js';
import { sendMail } from '@/service/mail/index.js';
import Schema from '@/config/validationSchema.js';
import Logger from '@/service/logger/index.js';

const INITIAL_RESEND_COOLDOWN_SECONDS = 30;

export const ValidationSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(255),
    email: Schema.email(),
    phone_number: Schema.phoneNumber(),
    password: z.string().trim().min(5, 'password must be at least 5 characters').max(255, 'Password must be less than 255 characters'),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {

  const {
    name, email, phone_number, password
  } = req.body as z.infer<typeof ValidationSchema.body>;

  const customer = await db.queryOne(
    'SELECT id FROM users WHERE email = $1 AND role = \'customer\'',
    [email],
  );

  if (customer && customer.is_deleted) {
    return res.status(StatusCodes.FORBIDDEN).json({ code : 'ACCOUNT_DELETED', message: 'account has been deleted please contact support' });
  }

  if (customer) return res.status(StatusCodes.ALREADY_EXISTS).json({ message: 'Customer already exists' });

  const token = await createEncryptedToken({
    type: TokenTypes.CUSTOMER_REGISTRATION_TOKEN, name, email, phone_number, password
  }, '10m');

  const otp = Math.floor(100000 + Math.random() * 900000);
  await RedisClient.set(token, String(otp), { EX: 10 * 60 });
  // Block resend for a short window right after the first OTP send.
  await RedisClient.set(`otp-resend:registration:${token}`, '1', { EX: INITIAL_RESEND_COOLDOWN_SECONDS });

  const emailHtml = emailVerifyOtp(String(otp));
  sendMail({ to: email, subject: 'Email Verification', html: emailHtml })
    .catch((error) => {
      Logger.error(`Failed to send email verification email to ${email}`, error);
    });

  res.status(StatusCodes.OK).json({
    token,
  });
}
