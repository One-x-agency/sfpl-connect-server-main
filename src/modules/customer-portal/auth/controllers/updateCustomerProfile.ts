import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  body: z.object({
    name: z.string().trim().max(255),
    phone_number: Schema.phoneNumber(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { name, phone_number } = req.body as z.infer<typeof ValidationSchema.body>;

  const customer = await db.queryOne(
    'SELECT * FROM users WHERE id = $1 AND role = \'customer\' AND is_deleted = false',
    [req.user.id],
  );
  if (!customer) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });

  const updatedCustomer = await db.queryOne(`
    UPDATE users SET name = $1, phone_number = $2 WHERE id = $3 AND role = 'customer' AND is_deleted = false RETURNING *
  `, [name, phone_number, req.user.id]);

  if (!updatedCustomer) return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update customer profile' });

  return res.status(StatusCodes.SUCCESS).send();
}
