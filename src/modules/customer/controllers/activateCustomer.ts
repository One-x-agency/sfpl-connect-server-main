import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

const PLACEHOLDER_EMAIL_REGEX = /^deleted\..+@account-deleted\.invalid$/i;

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  void next;

  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const customer = await db.queryOne<{
    id: string;
    email: string;
    is_deleted: boolean;
    metadata: Record<string, unknown> | null;
  }>(
    `
      SELECT id, email, is_deleted, metadata
      FROM users
      WHERE id = $1 AND role = 'customer'
    `,
    [id],
  );

  if (!customer) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });
  }

  const isPlaceholderEmail = PLACEHOLDER_EMAIL_REGEX.test(customer.email);
  const originalEmail = (
    customer.metadata?.account_deleted as { original_email?: string } | undefined
  )?.original_email?.trim().toLowerCase() ?? null;

  // If account is already active and email looks normal, nothing to activate.
  if (!customer.is_deleted && !isPlaceholderEmail) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Customer account is already active' });
  }

  // Repair needed only for legacy placeholder emails.
  if (isPlaceholderEmail && !originalEmail) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Cannot repair/activate account: original email is missing',
    });
  }

  if (originalEmail) {
    const existingByEmail = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2',
      [originalEmail, id],
    );

    if (existingByEmail) {
      return res.status(StatusCodes.ALREADY_EXISTS).json({
        message: 'Cannot activate account: original email is already used',
      });
    }
  }

  const activatedCustomer = await db.queryOne(
    `
      UPDATE users
      SET
        is_deleted = false,
        deleted_at = NULL,
        email = COALESCE($2, email),
        metadata = CASE
          WHEN $2 IS NOT NULL THEN COALESCE(metadata, '{}'::jsonb) - 'account_deleted'
          ELSE metadata
        END,
        updated_at = now()
      WHERE id = $1
        AND role = 'customer'
        AND (
          is_deleted = true
          OR (is_deleted = false AND LOWER(email) ~ '^deleted\\..+@account-deleted\\.invalid$')
        )
      RETURNING
        id,
        name,
        email,
        is_email_verified,
        phone_number,
        is_phone_number_verified,
        is_deleted,
        deleted_at,
        created_at,
        updated_at
    `,
    [id, originalEmail],
  );

  if (!activatedCustomer) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });
  }

  return res.status(StatusCodes.OK).json(activatedCustomer);
}
