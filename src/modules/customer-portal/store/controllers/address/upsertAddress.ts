import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    type: z.enum(['billing', 'shipping']),
  }),
  body: z.object({
    address: z.string().trim().min(3),
    city: z.string().trim().min(2).max(255),
    state_id: Schema.uuid(),
    postal_code: z.string().trim().regex(/^\d{6}$/, 'Postal code must be exactly 6 digits'),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user!.id;
  const { type } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const state = await db.queryOne('SELECT id FROM states WHERE id = $1', [body.state_id]);
  if (!state) return res.status(StatusCodes.NOT_FOUND).json({ message: 'State not found' });

  const existing = await db.queryOne(
    `SELECT id
     FROM connect_store_addresses
     WHERE customer_id = $1 AND type = $2`,
    [customerId, type],
  );

  const savedAddress = existing
    ? await db.queryOne(
      `UPDATE connect_store_addresses
       SET address = $1, city = $2, state_id = $3, postal_code = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, type, address, city, postal_code, state_id`,
      [body.address, body.city, body.state_id, body.postal_code, existing.id],
    )
    : await db.queryOne(
      `INSERT INTO connect_store_addresses (type, customer_id, address, state_id, city, postal_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, address, city, postal_code, state_id`,
      [type, customerId, body.address, body.state_id, body.city, body.postal_code],
    );

  return res.status(StatusCodes.OK).json({ data: savedAddress });
}
