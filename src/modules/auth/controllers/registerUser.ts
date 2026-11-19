import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { createEncryptedToken } from '@/utility/token.js';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import RedisClient from '@/service/redis/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import emailVerifyOtp from '@/utility/emailTemplates/emailVerifyOtp.js';
import { sendMail } from '@/service/mail/index.js';


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

  const user = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (user) return res.status(StatusCodes.ALREADY_EXISTS).json({ message: 'User already exists' });

  const token = await createEncryptedToken({
    type: TokenTypes.USER_REGISTRATION_TOKEN, name, email, phone_number, password
  }, '10m');

  const otp = Math.floor(100000 + Math.random() * 900000);
  await RedisClient.set(token, otp, { EX: 10 * 60 });

  const emailHtml = emailVerifyOtp(otp.toString() );
  await sendMail({ to: email, subject: 'Email Verification', html: emailHtml });

  return res.status(StatusCodes.OK).json({
    token,
  });
}
