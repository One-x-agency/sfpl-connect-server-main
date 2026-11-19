import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const customer = await db.queryOne(
    `
      SELECT
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
      FROM users
      WHERE id = $1 AND role = 'customer'
    `,
    [id],
  );

  if (!customer) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });
  }

  return res.status(StatusCodes.OK).json(customer);
}

