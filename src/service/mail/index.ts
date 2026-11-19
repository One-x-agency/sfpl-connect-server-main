import z from 'zod';
import env from '@/config/env.js';
import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import validateEnv from '@/utility/validateEnv.js';

const transportSchema = z.object({
  host: z.string().min(3).max(255),
  port: z.coerce.number().int().positive().max(65535),
  user: z.string().min(3).max(255),
  password: z.string().min(2).max(255),
});

const transportOptions = validateEnv(transportSchema, {
  host: env.smtp.host,
  port: env.smtp.port,
  user: env.smtp.user,
  password: env.smtp.password,
});

export async function sendMail({ to, subject, html }: SendMailOptions) {
  const transport = nodemailer.createTransport({
    host: transportOptions.host,
    port: transportOptions.port,
    secure: true,
    auth: {
      user: transportOptions.user,
      pass: transportOptions.password,
    },
  });
  const result = await transport.sendMail({
    from: env.smtp.user, to, subject, html
  });
  return result;
}
