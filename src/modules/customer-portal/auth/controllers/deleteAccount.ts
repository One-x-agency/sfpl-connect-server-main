import type {
  NextFunction,
  Request,
  Response,
} from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import accountDeleteNotification from '@/utility/emailTemplates/accountDeleteNotification.js';
import { sendMail } from '@/service/mail/index.js';
import Logger from '@/service/logger/index.js';
import { clearCustomerAuthCookies } from '@/utility/customerAuthCookies.js';

export const ValidationSchema = {
  body: z.object({
    password: z.string().trim().min(1, 'Password is required').max(255, 'Password must be less than 255 characters').optional(),
  }),
};

function clearAuthCookies(res: Response) {
  clearCustomerAuthCookies(res);
}

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  void next;

  const customerId = req.user!.id;
  const { password } = req.body as z.infer<typeof ValidationSchema.body>;

  const customer = await db.queryOne(
    `
      SELECT password_hash, name, email
      FROM users
      WHERE id = $1
        AND role = 'customer'
        AND is_deleted = false
    `,
    [customerId],
  );

  if (!customer) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });
  }

  if (customer.password_hash) {
    if (!password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Password is required to delete your account',
      });
    }
    const ok = await bcrypt.compare(password, customer.password_hash);
    if (!ok) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid password' });
    }
  }

  const updated = await db.queryOne(
    `
      UPDATE users
      SET
        is_deleted = true,
        deleted_at = now(),
        updated_at = now()
      WHERE id = $1
        AND role = 'customer'
        AND is_deleted = false
      RETURNING id
    `,
    [customerId],
  );

  if (!updated) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });
  }

  clearAuthCookies(res);

  const emailHtml = accountDeleteNotification(customer.name, customer.email);

  sendMail({
    to: customer.email,
    subject: 'Account Deletion Request',
    html: emailHtml,
  }).catch((error) => {
    Logger.error(`Failed to send account deletion email to ${customer.email}`, error);
  });

  return res.status(StatusCodes.OK).json({ message: 'Account deleted successfully' });
}

