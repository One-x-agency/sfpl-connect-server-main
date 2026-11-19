import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { logConnectStoreOrderActivity } from '@/modules/activity-log/services/activity-log.service.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';

const addressSchema = z.object({
  address: z.string().trim().min(3),
  city: z.string().trim().min(2).max(255),
  state_id: Schema.uuid(),
  postal_code: z.string().trim().regex(/^\d{6}$/, 'Postal code must be exactly 6 digits'),
});

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    billing: addressSchema,
    shipping: addressSchema.optional(),
    same_shipping_as_billing: z.boolean().default(false),
  }),
};

type StateRow = {
  id: string;
  name: string;
  gst_code: string;
};

function buildAddressPayload(
  fields: z.infer<typeof addressSchema>,
  state: StateRow,
) {
  return {
    address: fields.address,
    city: fields.city,
    state_id: fields.state_id,
    state_name: state.name,
    state_gst_code: state.gst_code,
    postal_code: fields.postal_code,
  };
}

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const order = await db.queryOne<{ id: string; status: string; serial: string | null }>(
    'SELECT id, status, serial FROM connect_store_orders WHERE id = $1',
    [id],
  );
  if (!order) throw new ServerError('Order not found');

  if (order.status === 'complete' || order.status === 'cancel') {
    throw new ServerError('Cannot update addresses for a completed or cancelled order');
  }

  const invoice = await db.queryOne<{ id: string }>(
    'SELECT id FROM invoices WHERE order_id = $1',
    [id],
  );
  if (invoice) {
    throw new ServerError('Cannot update addresses after invoice is issued');
  }

  const shippingFields = body.same_shipping_as_billing
    ? body.billing
    : body.shipping;

  if (!shippingFields) {
    throw new ServerError('Shipping address is required');
  }

  const [billingState, shippingState] = await Promise.all([
    db.queryOne<StateRow>(
      'SELECT id, name, gst_code FROM states WHERE id = $1',
      [body.billing.state_id],
    ),
    db.queryOne<StateRow>(
      'SELECT id, name, gst_code FROM states WHERE id = $1',
      [shippingFields.state_id],
    ),
  ]);

  if (!billingState || !shippingState) {
    throw new ServerError('State not found');
  }

  const updated = await db.queryOne(
    `UPDATE connect_store_orders
     SET billing_address = $2::jsonb,
         shipping_address = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING
       id,
       serial,
       payment_status,
       status,
       total_amount_in_paisa,
       paid_amount_in_paisa,
       is_paid,
       billing_details,
       billing_address,
       shipping_address,
       docket_number,
       delivery_partner,
       status_details,
       razorpay_order_id,
       razorpay_payment_id,
       created_at,
       updated_at`,
    [
      id,
      JSON.stringify(buildAddressPayload(body.billing, billingState)),
      JSON.stringify(buildAddressPayload(shippingFields, shippingState)),
    ],
  );

  if (!updated) throw new ServerError('Order not found');

  await logConnectStoreOrderActivity(db, req, {
    orderId: id,
    orderSerial: order.serial,
    action: 'update',
    metadata: {
      address_update: true,
    },
  });

  return res.status(StatusCodes.OK).json({ data: updated });
}
