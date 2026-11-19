import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import ServerError from '@/core/serverError.class.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import env from '@/config/env.js';
import razorpay from '@/modules/payment/services/razorpay.client.js';
import { markPaymentSuccess } from '@/modules/payment/services/payment.service.js';

export const ValidationSchema = {
  body: z.object({
    razorpay_order_id: z.string().trim().min(1),
    razorpay_payment_id: z.string().trim().min(1),
    razorpay_signature: z.string().trim().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const body = req.body as z.infer<typeof ValidationSchema.body>;
  const customerId = req.user!.id;

  if (body.razorpay_signature) {
    if (!env.razorpay.keySecret) throw new ServerError('Payment gateway not configured');
    const expected = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest('hex');
    if (expected !== body.razorpay_signature) throw new ServerError('Invalid payment signature');
  }

  const payment = await razorpay.payments.fetch(body.razorpay_payment_id);
  if (payment.order_id !== body.razorpay_order_id || payment.status !== 'captured') {
    throw new ServerError('Payment not captured');
  }

  const order = await db.queryOne(
    `SELECT id, customer_id
     FROM connect_store_orders
     WHERE razorpay_order_id = $1`,
    [body.razorpay_order_id],
  );
  if (!order || order.customer_id !== customerId) throw new ServerError('Order not found');

  const result = await markPaymentSuccess(db, {
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    amount: Number(payment.amount),
    signature: body.razorpay_signature,
  });

  return res.status(StatusCodes.OK).json({ data: result.order });
}
