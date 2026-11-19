import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    order_id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user!.id;
  const { order_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const order = await db.queryOne(
    `SELECT
      o.id,
      o.serial,
      o.payment_status,
      o.status,
      o.total_amount_in_paisa,
      o.paid_amount_in_paisa,
      o.is_paid,
      o.razorpay_payment_id,
      o.billing_details,
      o.billing_address,
      o.shipping_address,
      o.created_at
     FROM connect_store_orders o
     WHERE o.id = $1 AND o.customer_id = $2`,
    [order_id, customerId],
  );
  if (!order) throw new ServerError('Order not found');

  const items = await db.queryAll(
    `SELECT
      oi.id,
      oi.device_id,
      oi.device_name,
      oi.hsn_sac,
      oi.quantity,
      oi.price_in_paisa,
      CASE
        WHEN f.id IS NULL THEN NULL
        ELSE jsonb_build_object('id', f.id, 'key', f.key, 'url', f.url)
      END AS image
     FROM connect_store_order_items oi
     LEFT JOIN connect_store_devices d ON d.id = oi.device_id
     LEFT JOIN files f ON f.id = d.image_id
     WHERE oi.order_id = $1`,
    [order_id],
  );

  return res.status(StatusCodes.OK).json({
    data: {
      ...order,
      items,
    },
  });
}
