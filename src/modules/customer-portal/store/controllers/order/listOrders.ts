import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    offset: Schema.pagination.offset(),
    limit: Schema.pagination.limit(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user!.id;
  const query = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> }).validatedQuery;

  const orders = await db.namedQueryAll(
    `SELECT
      o.id,
      o.serial,
      o.payment_status,
      o.status,
      o.total_amount_in_paisa,
      o.paid_amount_in_paisa,
      o.is_paid,
      o.created_at,
      COALESCE(SUM(oi.quantity), 0)::int AS total_item_count
     FROM connect_store_orders o
     LEFT JOIN connect_store_order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = $customer_id
       AND o.payment_status = 'paid'
       AND o.status <> 'cancel'
     GROUP BY o.id
     ORDER BY o.created_at DESC
     OFFSET $offset LIMIT $limit`,
    {
      customer_id: customerId,
      offset: query.offset,
      limit: query.limit,
    },
  );

  return res.status(StatusCodes.OK).json({ data: orders });
}
