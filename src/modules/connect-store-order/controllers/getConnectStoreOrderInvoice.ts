import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';
import { getAssignedDevicesForOrder } from '@/modules/connect-store-order/services/order-fulfillment.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

const INVOICE_SELECT = `
  id,
  order_id,
  order_number,
  serial,
  issued_at,
  status,
  billing_details,
  billing_address,
  shipping_address,
  place_of_supply_state_name,
  place_of_supply_gst_code,
  is_inter_state,
  items,
  charges,
  taxable_amount_in_paisa,
  tax_amount_in_paisa,
  total_amount_in_paisa,
  seller_gstin,
  seller_state_gst_code,
  created_at,
  updated_at
`;

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const order = await db.queryOne(
    `SELECT id FROM connect_store_orders WHERE id = $1`,
    [id],
  );
  if (!order) throw new ServerError('Order not found');

  const invoice = await db.queryOne(
    `SELECT ${INVOICE_SELECT}
     FROM invoices
     WHERE order_id = $1`,
    [id],
  );
  if (!invoice) throw new ServerError('Invoice not found');

  const assignedDevices = await getAssignedDevicesForOrder(db, id);

  return res.status(StatusCodes.OK).json({
    data: {
      ...invoice,
      assigned_devices: assignedDevices,
    },
  });
}
