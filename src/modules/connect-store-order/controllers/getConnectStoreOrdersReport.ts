import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { ORDER_STATUSES } from '@/modules/connect-store-order/constants/order-status.js';

export const ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    payment_status: z.enum(['pending', 'paid', 'failed']).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const query = (req as Request & {
    validatedQuery: z.infer<typeof ValidationSchema.query>;
  }).validatedQuery;
  const queryParams: Record<string, unknown> = {};
  const conditions: string[] = [];

  if (query.search) {
    queryParams.search = `%${query.search}%`;
    conditions.push(`(
      o.serial ILIKE $search
      OR u.name ILIKE $search
      OR u.email ILIKE $search
      OR u.phone_number ILIKE $search
      OR u.organization_name ILIKE $search
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
      o.billing_details,
      o.billing_address,
      o.shipping_address,
      o.created_at,
      o.updated_at,
      u.id AS customer_id,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone_number AS customer_phone,
      u.organization_name AS customer_organization_name,
      u.gst_number AS customer_gst_number,
      u.pan_number AS customer_pan_number,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'to_status', h.to_status,
              'staff_name', h.staff_name,
              'timestamp', h."timestamp"
            )
            ORDER BY h."timestamp" ASC, h.id ASC
          )
          FROM connect_store_order_status_history h
          WHERE h.order_id = o.id
        ),
        '[]'::jsonb
      ) AS status_history
     FROM connect_store_orders o
     JOIN users u ON u.id = o.customer_id
     ${whereClause}
     ORDER BY o.created_at DESC`,
    queryParams,
  );

  return res.status(StatusCodes.OK).json({ data: orders });
}
