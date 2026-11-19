import type { DatabaseClient } from '@/service/database/index.js';
import ServerError from '@/core/serverError.class.js';

type MarkPaymentSuccessInput = {
  orderId: string;
  paymentId: string;
  amount: number;
  signature?: string;
};

export async function markPaymentSuccess(
  db: DatabaseClient,
  { orderId, paymentId, amount, signature }: MarkPaymentSuccessInput,
) {
  const existingByPaymentId = await db.queryOne(
    `SELECT id, serial, payment_status, is_paid
     FROM connect_store_orders
     WHERE razorpay_payment_id = $1`,
    [paymentId],
  );

  if (existingByPaymentId) {
    return { isDuplicate: true, order: existingByPaymentId };
  }

  const order = await db.queryOne<{
    id: string;
    customer_id: string;
    total_amount_in_paisa: number;
    paid_amount_in_paisa: number;
  }>(
    `SELECT id, customer_id, total_amount_in_paisa, paid_amount_in_paisa
     FROM connect_store_orders
     WHERE razorpay_order_id = $1`,
    [orderId],
  );

  if (!order) throw new ServerError('Order not found for payment');

  const paidAmount = Math.min(order.total_amount_in_paisa, Math.max(order.paid_amount_in_paisa, amount));
  const isPaid = paidAmount >= order.total_amount_in_paisa;

  await db.query('BEGIN');

  try {
    const updatedOrder = await db.queryOne(
      `UPDATE connect_store_orders
       SET
         is_paid = $1,
         payment_status = $2,
         paid_amount_in_paisa = $3,
         razorpay_payment_id = $4,
         razorpay_signature = COALESCE($5, razorpay_signature),
         serial_number = CASE
           WHEN $1 = true AND serial_number IS NULL THEN nextval('connect_store_order_serial_seq')
           ELSE serial_number
         END,
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, serial, payment_status, status, is_paid, total_amount_in_paisa, paid_amount_in_paisa`,
      [isPaid, isPaid ? 'paid' : 'pending', paidAmount, paymentId, signature ?? null, order.id],
    );

    await db.query(
      `DELETE FROM connect_store_cart_items
       WHERE cart_id IN (
         SELECT id FROM connect_store_carts WHERE customer_id = $1
       )`,
      [order.customer_id],
    );

    await db.query('COMMIT');
    return { isDuplicate: false, order: updatedOrder };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
