import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { decryptEncryptedToken } from '@/utility/token.js';
import RedisClient from '@/service/redis/index.js';
import emailVerifyOtp from '@/utility/emailTemplates/emailVerifyOtp.js';
import { sendMail } from '@/service/mail/index.js';
import Logger from '@/service/logger/index.js';

const RESEND_COOLDOWN_SECONDS = 60;

export const ValidationSchema = {
  body: z.object({
    token: z.string().trim().min(1).max(5000),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { token } = req.body as z.infer<typeof ValidationSchema.body>;

  const decryptedToken = await decryptEncryptedToken(token) as {
    type: TokenTypes;
    name: string;
    email: string;
    phone_number?: string;
    password: string;
  } | null;

  if (!decryptedToken || decryptedToken.type !== TokenTypes.CUSTOMER_REGISTRATION_TOKEN) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid or expired token' });
  }

  const cooldownKey = `otp-resend:registration:${token}`;
  const onCooldown = await RedisClient.get(cooldownKey);
  if (onCooldown) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Please wait a moment before requesting another OTP',
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  await RedisClient.set(token, String(otp), { EX: 10 * 60 });
  await RedisClient.set(cooldownKey, '1', { EX: RESEND_COOLDOWN_SECONDS });

  const { email } = decryptedToken;
  const emailHtml = emailVerifyOtp(String(otp));

  sendMail({ to: email, subject: 'Email Verification', html: emailHtml })
    .catch((error) => {
      Logger.error(`Failed to resend registration OTP to ${email}`, error);
    });

  return res.status(StatusCodes.OK).json({
    message: 'A new verification code has been sent to your email',
  });
}
