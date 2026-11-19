import type { DatabaseClient } from '@/service/database/index.js';
import ServerError from '@/core/serverError.class.js';
import RedisClient from '@/service/redis/index.js';
import orderOtpEmail from '@/utility/emailTemplates/orderOtpEmail.js';
import { sendMail } from '@/service/mail/index.js';
import Logger from '@/service/logger/index.js';
import type { OrderOtpPurpose, OrderStatus } from '@/modules/connect-store-order/constants/order-status.js';

const OTP_TTL_SECONDS = 10 * 60;

export type OrderForTransition = {
  id: string;
  status: string;
  is_paid: boolean;
  customer_id: string;
  customer_email: string | null;
  customer_name: string | null;
  order_serial?: string | null;
  billing_details?: Record<string, unknown> | null;
};

export function assertTransition(order: OrderForTransition, fromStatus: OrderStatus, actionLabel: string) {
  if (order.status !== fromStatus) {
    throw new ServerError(`Order must be in ${fromStatus} status to ${actionLabel}`);
  }
}

export function assertPaidForFulfillment(order: OrderForTransition) {
  if (!order.is_paid) {
    throw new ServerError('Order must be paid before processing');
  }
}

export function resolveOrderCustomerEmail(order: OrderForTransition) {
  const accountEmail = typeof order.customer_email === 'string' ? order.customer_email.trim() : '';
  if (accountEmail) return accountEmail;

  const billingEmail = order.billing_details?.email;
  if (typeof billingEmail === 'string' && billingEmail.trim()) {
    return billingEmail.trim();
  }

  return null;
}

async function ensureRedisReady() {
  if (!RedisClient.isOpen) {
    await RedisClient.connect();
  }
}

export async function getOrderForTransition(db: DatabaseClient, orderId: string): Promise<OrderForTransition | null> {
  return db.queryOne<OrderForTransition>(
    `SELECT
      o.id,
      o.status,
      o.is_paid,
      o.customer_id,
      o.serial AS order_serial,
      TRIM(u.email) AS customer_email,
      u.name AS customer_name,
      o.billing_details
     FROM connect_store_orders o
     JOIN users u ON u.id = o.customer_id
     WHERE o.id = $1`,
    [orderId],
  );
}

export async function getRequiredConnectCount(db: DatabaseClient, orderId: string): Promise<number> {
  const row = await db.queryOne<{ required_count: number }>(
    `SELECT COALESCE(SUM(d.connect_count * oi.quantity), 0)::int AS required_count
     FROM connect_store_order_items oi
     JOIN connect_store_devices d ON d.id = oi.device_id
     WHERE oi.order_id = $1`,
    [orderId],
  );
  return row?.required_count ?? 0;
}

export async function assignDevicesToOrder(
  db: DatabaseClient,
  orderId: string,
  customerId: string,
  deviceIds: string[],
) {
  if (!deviceIds.length) {
    throw new ServerError('Select at least one Connect device to ship');
  }

  const uniqueIds = [...new Set(deviceIds)];
  if (uniqueIds.length !== deviceIds.length) {
    throw new ServerError('Duplicate Connect devices are not allowed');
  }

  const requiredCount = await getRequiredConnectCount(db, orderId);
  if (requiredCount < 1) {
    throw new ServerError('Order has no Connect units to ship');
  }
  if (uniqueIds.length !== requiredCount) {
    throw new ServerError(`Select exactly ${requiredCount} Connect device(s) for this order`);
  }

  const available = await db.queryAll<{ id: string }>(
    `SELECT id
     FROM devices
     WHERE id = ANY($1::uuid[])
       AND user_id IS NULL
       AND order_id IS NULL`,
    [uniqueIds],
  );

  if (available.length !== uniqueIds.length) {
    throw new ServerError('One or more selected Connect devices are already assigned to a user or linked to an order');
  }

  await db.query(
    `UPDATE devices
     SET user_id = $2,
         project_id = NULL,
         order_id = $1,
         updated_at = NOW()
     WHERE id = ANY($3::uuid[])
       AND user_id IS NULL
       AND order_id IS NULL`,
    [orderId, customerId, uniqueIds],
  );

  const assigned = await db.queryAll<{ id: string }>(
    `SELECT id FROM devices WHERE order_id = $1 AND id = ANY($2::uuid[])`,
    [orderId, uniqueIds],
  );

  if (assigned.length !== uniqueIds.length) {
    throw new ServerError('Failed to assign all selected Connect devices');
  }

  return uniqueIds;
}

export async function getAssignedDevicesForOrder(db: DatabaseClient, orderId: string) {
  return db.queryAll<{
    id: string;
    serial: string | null;
    imei: string;
    batch_number: string | null;
  }>(
    `SELECT
      d.id,
      d.serial,
      d.imei,
      d.batch_number
     FROM devices d
     WHERE d.order_id = $1
        OR d.id IN (
          SELECT (jsonb_array_elements_text(
            COALESCE(
              (
                SELECT o.status_details -> 'shipping' -> 'device_ids'
                FROM connect_store_orders o
                WHERE o.id = $1
              ),
              '[]'::jsonb
            )
          ))::uuid
        )
     ORDER BY d.serial_number ASC`,
    [orderId],
  );
}

export async function mergeStatusDetails(
  db: DatabaseClient,
  orderId: string,
  stage: string,
  payload: Record<string, unknown>,
) {
  await db.queryOne(
    `UPDATE connect_store_orders
     SET status_details = COALESCE(status_details, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [orderId, JSON.stringify({ [stage]: payload })],
  );
}

function otpRedisKey(orderId: string, purpose: OrderOtpPurpose) {
  return `order-otp:${orderId}:${purpose}`;
}

type SendOrderOtpOptions = {
  orderSerial?: string | null;
};

export async function sendOrderOtp(
  orderId: string,
  purpose: OrderOtpPurpose,
  customerEmail: string,
  customerName?: string | null,
  options: SendOrderOtpOptions = {},
) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  await ensureRedisReady();
  await RedisClient.set(otpRedisKey(orderId, purpose), otp, { EX: OTP_TTL_SECONDS });

  const subject = purpose === 'delivered'
    ? 'SFPL order delivery verification code'
    : 'SFPL order completion verification code';

  const emailHtml = orderOtpEmail({
    otp,
    purpose,
    customerName,
    orderSerial: options.orderSerial,
  });

  try {
    await sendMail({
      to: customerEmail,
      subject,
      html: emailHtml,
    });
  } catch (error) {
    await RedisClient.del(otpRedisKey(orderId, purpose));
    const message = error instanceof Error ? error.message : 'Unknown email error';
    throw new ServerError(`Failed to send OTP email: ${message}`);
  }

  Logger.info(`Order OTP generated for ${orderId} (${purpose}) and emailed to ${customerEmail}`);

  return {
    sent_to: customerEmail,
    customer_name: customerName ?? null,
    otp,
  };
}

export async function verifyOrderOtp(orderId: string, purpose: OrderOtpPurpose, otp: string) {
  await ensureRedisReady();
  const storedOtp = await RedisClient.get(otpRedisKey(orderId, purpose));
  const normalizedOtp = otp.trim();
  const storedOtpValue = storedOtp == null ? '' : String(storedOtp).trim();
  if (!storedOtpValue || storedOtpValue !== normalizedOtp) {
    throw new ServerError('Invalid or expired OTP');
  }
  await RedisClient.del(otpRedisKey(orderId, purpose));
}

export async function updateOrderStatus(
  db: DatabaseClient,
  orderId: string,
  status: OrderStatus,
  staffId: string | undefined,
  shippingDetails?: {
    docketNumber: string;
    deliveryPartner: string;
  },
) {
  if (!staffId) throw new ServerError('Authenticated staff member is required');

  const order = await db.queryOne(
    `WITH actor AS (
       SELECT
         id,
         COALESCE(NULLIF(TRIM(name), ''), NULLIF(TRIM(email), ''), 'Unknown staff') AS staff_name
       FROM users
       WHERE id = $3
     ),
     updated_order AS (
       UPDATE connect_store_orders
       SET status = $1,
           docket_number = COALESCE($4, docket_number),
           delivery_partner = COALESCE($5, delivery_partner),
           updated_at = NOW()
       WHERE id = $2
         AND EXISTS (SELECT 1 FROM actor)
       RETURNING id, serial, status, payment_status, total_amount_in_paisa, paid_amount_in_paisa,
         is_paid, docket_number, delivery_partner, status_details, created_at, updated_at
     ),
     history AS (
       INSERT INTO connect_store_order_status_history (
         order_id,
         to_status,
         staff_id,
         staff_name,
         "timestamp"
       )
       SELECT updated_order.id, $1, actor.id, actor.staff_name, NOW()
       FROM updated_order
       CROSS JOIN actor
       RETURNING id
     )
     SELECT updated_order.*
     FROM updated_order
     CROSS JOIN history`,
    [
      status,
      orderId,
      staffId,
      shippingDetails?.docketNumber ?? null,
      shippingDetails?.deliveryPartner ?? null,
    ],
  );
  if (!order) throw new ServerError('Order not found');
  return order;
}
