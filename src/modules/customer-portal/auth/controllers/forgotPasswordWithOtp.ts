import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { createEncryptedToken } from '@/utility/token.js';
import RedisClient from '@/service/redis/index.js';
import emailVerifyOtp from '@/utility/emailTemplates/emailVerifyOtp.js';
import { sendMail } from '@/service/mail/index.js';

const INITIAL_RESEND_COOLDOWN_SECONDS = 30;

export const ValidationSchema = {
  body: z.object({
    email: Schema.email(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { email } = req.body as z.infer<typeof ValidationSchema.body>;

  const customer = await db.queryOne(
    'SELECT id FROM users WHERE email = $1 AND role = \'customer\'',
    [email],
  );

  if (!customer) return res.status(StatusCodes.OK).json({ message: 'user with this email does not exist' });

  if (customer.is_deleted) return res.status(StatusCodes.FORBIDDEN).json({ code : 'ACCOUNT_DELETED', message: 'account has been deleted please contact support' });

  const token = await createEncryptedToken(
    {
      type: TokenTypes.CUSTOMER_PASSWORD_RESET_TOKEN,
      customer_id: customer.id,
    },
    '10m',
  );

  const otp = Math.floor(100000 + Math.random() * 900000);
  await RedisClient.set(token, String(otp), { EX: 10 * 60 });
  // Block resend for a short window right after the first OTP send.
  await RedisClient.set(`otp-resend:forgot-password:${token}`, '1', { EX: INITIAL_RESEND_COOLDOWN_SECONDS });

  const emailHtml = emailVerifyOtp(String(otp));

  await sendMail({
    to: email,
    subject: 'Password reset verification code',
    html: emailHtml,
  });

  return res.status(StatusCodes.OK).json({
    message: 'email for reset password is sent to your email',
    token,
  });
}
