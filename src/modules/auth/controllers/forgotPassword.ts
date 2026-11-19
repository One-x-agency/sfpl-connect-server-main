import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes, TokenTypes } from '@/config/constant.js';
import { createEncryptedToken } from '@/utility/token.js';
import RedisClient from '@/service/redis/index.js';
import forgotPasswordTemplate from '@/utility/emailTemplates/forgotPassword.js';
import { sendMail } from '@/service/mail/index.js';

export const ValidationSchema = {
  body: z.object({
    email: Schema.email(),
    redirect_url: z.url(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { email, redirect_url } = req.body as z.infer<typeof ValidationSchema.body>;

  const user = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);

  // Always respond with OK to avoid leaking whether the email exists.
  if (!user) {
    return res.status(StatusCodes.OK).json({
      message: 'email for reset password is sent to your email',
    });
  }

  const token = await createEncryptedToken(
    {
      type: TokenTypes.USER_PASSWORD_RESET_TOKEN,
      user_id: user.id,
    },
    '10m',
  );

  await RedisClient.set(token, '1', { EX: 10 * 60 });

  const baseUrl = redirect_url && typeof redirect_url === 'string' ? redirect_url : '';
  const resetUrl = baseUrl ? `${baseUrl}?token=${encodeURIComponent(token)}` : token;

  const emailHtml = forgotPasswordTemplate(resetUrl);

  await sendMail({
    to: email,
    subject: 'Reset your password',
    html: emailHtml,
  });

  return res.status(StatusCodes.OK).json({
    message: 'email for reset password is sent to your email',
  });
}
