import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';
import { resolveCartId } from '@/modules/customer-portal/store/services/cart.service.js';

export const ValidationSchema = {
  params: z.object({
    device_id: Schema.uuid(),
  }),
  body: z.object({
    quantity: z.number().int().min(0).max(100),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { device_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { quantity } = req.body as z.infer<typeof ValidationSchema.body>;

  const device = await db.queryOne(
    `SELECT id, in_stock, is_active
     FROM connect_store_devices
     WHERE id = $1`,
    [device_id],
  );
  if (!device || !device.is_active) throw new ServerError('Connect device not found');
  if (quantity > 0 && !device.in_stock) throw new ServerError('Out of stock');

  const cartId = await resolveCartId(db, {
    customerId: req.storefront?.customerId,
    guestCartId: req.storefront?.guestCartId,
  });

  if (quantity > 0) {
    await db.query(
      `INSERT INTO connect_store_cart_items (cart_id, device_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, device_id)
       DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
      [cartId, device_id, quantity],
    );
  } else {
    await db.query(
      'DELETE FROM connect_store_cart_items WHERE cart_id = $1 AND device_id = $2',
      [cartId, device_id],
    );
  }

  return res.status(StatusCodes.OK).json({
    data: {
      device_id,
      quantity,
      guest_cart_id: req.storefront?.guestCartId,
    },
  });
}
