import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';
import env from '@/config/env.js';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
} from '@/modules/payment/razorpay/createOrder.js';
import {
  storeCustomerProfileSchema,
  updateCustomerStoreProfile,
} from '@/modules/customer-portal/store/services/customer-store-profile.service.js';

export const ValidationSchema = {
  body: storeCustomerProfileSchema.omit({
    full_name: true,
    phone_number: true,
  }).extend({
    shipping_address: z.string().trim().min(3),
    shipping_state_id: Schema.uuid(),
    shipping_city: z.string().trim().min(2).max(255),
    shipping_postal_code: z.string().trim().regex(/^\d{6}$/, 'Postal code must be exactly 6 digits'),
    billing_address: z.string().trim().min(3),
    billing_state_id: Schema.uuid(),
    billing_city: z.string().trim().min(2).max(255),
    billing_postal_code: z.string().trim().regex(/^\d{6}$/, 'Postal code must be exactly 6 digits'),
  }),
};

function splitName(fullName: string) {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const [firstName, ...rest] = trimmed.split(' ');
  return {
    first_name: firstName || '',
    last_name: rest.join(' ') || '-',
  };
}

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user!.id;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const customerAccount = await db.queryOne<{
    email: string;
    full_name: string;
    phone_number: string;
  }>(
    `SELECT
      TRIM(email) AS email,
      TRIM(name) AS full_name,
      TRIM(phone_number) AS phone_number
     FROM users
     WHERE id = $1
       AND role = 'customer'
       AND is_deleted = false`,
    [customerId],
  );
  if (!customerAccount?.email) throw new ServerError('Customer email is required to place an order');
  if (!customerAccount.full_name) throw new ServerError('Customer name is required to place an order');
  if (!customerAccount.phone_number) throw new ServerError('Customer phone number is required to place an order');

  const { first_name, last_name } = splitName(customerAccount.full_name);

  const cartItems = await db.queryAll<{
    device_id: string;
    quantity: number;
    device_name: string;
    hsn_sac: string | null;
    price_in_paisa: number;
    in_stock: boolean;
  }>(
    `SELECT
      ci.device_id,
      ci.quantity,
      d.name AS device_name,
      d.hsn_sac,
      d.price_in_paisa,
      d.in_stock
     FROM connect_store_carts c
     JOIN connect_store_cart_items ci ON ci.cart_id = c.id
     JOIN connect_store_devices d ON d.id = ci.device_id
     WHERE c.customer_id = $1
       AND d.is_active = true`,
    [customerId],
  );

  if (!cartItems.length) throw new ServerError('Cart is empty');

  for (const item of cartItems) {
    if (!item.hsn_sac) {
      throw new ServerError(`HSN/SAC is missing for ${item.device_name}`);
    }
    if (!item.in_stock) {
      throw new ServerError(`${item.device_name} is out of stock`);
    }
  }

  const total_amount_in_paisa = cartItems.reduce(
    (sum, item) => sum + item.price_in_paisa * item.quantity,
    0,
  );

  const [billingState, shippingState] = await Promise.all([
    db.queryOne('SELECT id, name, gst_code FROM states WHERE id = $1', [body.billing_state_id]),
    db.queryOne('SELECT id, name, gst_code FROM states WHERE id = $1', [body.shipping_state_id]),
  ]);
  if (!billingState || !shippingState) throw new ServerError('State not found');

  await db.query('BEGIN');

  try {
    await updateCustomerStoreProfile(db, customerId, {
      ...body,
      full_name: customerAccount.full_name,
      phone_number: customerAccount.phone_number,
    });

    const organizationName = body.organization_name?.trim() || null;
    const gstNumber = body.gst_number?.trim().toUpperCase() || null;
    const panNumber = body.pan_number?.trim().toUpperCase() || null;

    const order = await db.queryOne(
      `INSERT INTO connect_store_orders (
        customer_id,
        payment_status,
        status,
        total_amount_in_paisa,
        paid_amount_in_paisa,
        is_paid,
        billing_details,
        billing_address,
        shipping_address
      ) VALUES (
        $1,
        'pending',
        'pending',
        $2,
        0,
        false,
        $3,
        $4,
        $5
      )
      RETURNING id, serial, total_amount_in_paisa, payment_status, status`,
      [
        customerId,
        total_amount_in_paisa,
        JSON.stringify({
          full_name: customerAccount.full_name,
          email: customerAccount.email,
          phone_number: customerAccount.phone_number,
          first_name,
          last_name,
          organization_name: organizationName,
          gst_number: gstNumber,
          pan_number: panNumber,
        }),
        JSON.stringify({
          address: body.billing_address,
          state_id: body.billing_state_id,
          state_name: billingState.name,
          state_gst_code: billingState.gst_code,
          city: body.billing_city,
          postal_code: body.billing_postal_code,
        }),
        JSON.stringify({
          address: body.shipping_address,
          state_id: body.shipping_state_id,
          state_name: shippingState.name,
          state_gst_code: shippingState.gst_code,
          city: body.shipping_city,
          postal_code: body.shipping_postal_code,
        }),
      ],
    );

    for (const item of cartItems) {
      await db.query(
        `INSERT INTO connect_store_order_items (order_id, device_id, device_name, hsn_sac, quantity, price_in_paisa)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order!.id, item.device_id, item.device_name, item.hsn_sac, item.quantity, item.price_in_paisa],
      );
    }

    const upsertAddress = async (
      type: 'billing' | 'shipping',
      address: string,
      stateId: string,
      city: string,
      postalCode: string,
    ) => {
      const existing = await db.queryOne(
        `SELECT id FROM connect_store_addresses WHERE customer_id = $1 AND type = $2`,
        [customerId, type],
      );
      if (existing) {
        await db.query(
          `UPDATE connect_store_addresses
           SET address = $1, state_id = $2, city = $3, postal_code = $4, updated_at = NOW()
           WHERE id = $5`,
          [address, stateId, city, postalCode, existing.id],
        );
      } else {
        await db.query(
          `INSERT INTO connect_store_addresses (type, customer_id, address, state_id, city, postal_code)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [type, customerId, address, stateId, city, postalCode],
        );
      }
    };

    await upsertAddress('billing', body.billing_address, body.billing_state_id, body.billing_city, body.billing_postal_code);
    await upsertAddress('shipping', body.shipping_address, body.shipping_state_id, body.shipping_city, body.shipping_postal_code);

    let razorpayOrder = null;
    if (isRazorpayConfigured()) {
      razorpayOrder = await createRazorpayOrder({
        amountInPaisa: total_amount_in_paisa,
        receipt: String(order!.id),
        notes: {
          customer_id: String(customerId),
          order_id: String(order!.id),
        },
      });

      await db.query(
        'UPDATE connect_store_orders SET razorpay_order_id = $1 WHERE id = $2',
        [razorpayOrder.id, order!.id],
      );
    }

    await db.query('COMMIT');

    return res.status(StatusCodes.OK).json({
      data: {
        order,
        payment: razorpayOrder,
        razorpay_key_id: env.razorpay.keyId || null,
      },
    });
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
