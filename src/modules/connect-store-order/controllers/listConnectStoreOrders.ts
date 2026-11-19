import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { ORDER_STATUSES } from '@/modules/connect-store-order/constants/order-status.js';

export const ValidationSchema = {
  query: z.object({
    offset: Schema.pagination.offset(),
    limit: Schema.pagination.limit(),
    search: z.string().trim().optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    payment_status: z.enum(['pending', 'paid', 'failed']).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const query = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> }).validatedQuery;
  const queryParams: Record<string, unknown> = {
    offset: query.offset,
    limit: query.limit,
  };
  const conditions: string[] = [];

  if (query.search) {
    queryParams.search = `%${query.search}%`;
    conditions.push(`(
      o.serial ILIKE $search
      OR u.name ILIKE $search
      OR u.email ILIKE $search
      OR u.phone_number ILIKE $search
    )`);
  }

  if (query.status) {
    queryParams.status = query.status;
    conditions.push('o.status = $status');
  }

  if (query.payment_status) {
    queryParams.payment_status = query.payment_status;
    conditions.push('o.payment_status = $payment_status');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const orders = await db.namedQueryAll(
    `SELECT
      o.id,
      o.serial,
      o.payment_status,
      o.status,
      o.total_amount_in_paisa,
      o.paid_amount_in_paisa,
      o.is_paid,
      o.docket_number,
      o.delivery_partner,
      o.status_details,
      o.created_at,
      u.id AS customer_id,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone_number AS customer_phone,
      COALESCE(SUM(oi.quantity), 0)::int AS total_item_count
     FROM connect_store_orders o
     JOIN users u ON u.id = o.customer_id
     LEFT JOIN connect_store_order_items oi ON oi.order_id = o.id
     ${whereClause}
     GROUP BY o.id, u.id
     ORDER BY o.created_at DESC
     OFFSET $offset LIMIT $limit`,
    queryParams,
  );

  return res.status(StatusCodes.OK).json({ data: orders });
}
