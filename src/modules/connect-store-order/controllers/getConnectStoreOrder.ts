import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const order = await db.queryOne(
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
      o.docket_number,
      o.delivery_partner,
      o.status_details,
      o.razorpay_order_id,
      o.razorpay_payment_id,
      o.created_at,
      o.updated_at,
      u.id AS customer_id,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone_number AS customer_phone,
      u.organization_name AS customer_organization_name,
      u.gst_number AS customer_gst_number,
      u.pan_number AS customer_pan_number,
      u.is_email_verified AS customer_is_email_verified,
      u.is_phone_number_verified AS customer_is_phone_number_verified,
      u.created_at AS customer_created_at
     FROM connect_store_orders o
     JOIN users u ON u.id = o.customer_id
     WHERE o.id = $1`,
    [id],
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
      COALESCE(d.connect_count, 1) AS connect_count,
      (COALESCE(d.connect_count, 1) * oi.quantity)::int AS total_connect_count,
      CASE
        WHEN f.id IS NULL THEN NULL
        ELSE jsonb_build_object('id', f.id, 'key', f.key, 'url', f.url)
      END AS image
     FROM connect_store_order_items oi
     LEFT JOIN connect_store_devices d ON d.id = oi.device_id
     LEFT JOIN files f ON f.id = d.image_id
     WHERE oi.order_id = $1`,
    [id],
  );

  const assignedDevices = await db.queryAll(
    `SELECT
      id,
      imei,
      name,
      serial,
      batch_number,
      user_id,
      order_id,
      created_at
     FROM devices
     WHERE order_id = $1
     ORDER BY serial_number ASC`,
    [id],
  );

  const invoice = await db.queryOne(
    `SELECT
      id,
      serial,
      order_number,
      issued_at,
      status,
      place_of_supply_state_name,
      place_of_supply_gst_code,
      is_inter_state,
      taxable_amount_in_paisa,
      tax_amount_in_paisa,
      total_amount_in_paisa
     FROM invoices
     WHERE order_id = $1`,
    [id],
  );

  const statusHistory = await db.queryAll(
    `SELECT
      to_status,
      staff_id,
      staff_name,
      "timestamp" AS timestamp
     FROM connect_store_order_status_history
     WHERE order_id = $1
     ORDER BY "timestamp" ASC, id ASC`,
    [id],
  );

  return res.status(StatusCodes.OK).json({
    data: {
      ...order,
      items,
      assigned_devices: assignedDevices,
      required_connect_count: items.reduce(
        (sum: number, item: { total_connect_count?: number }) => sum + Number(item.total_connect_count || 0),
        0,
      ),
      invoice: invoice ?? null,
      status_history: statusHistory,
    },
  });
}
