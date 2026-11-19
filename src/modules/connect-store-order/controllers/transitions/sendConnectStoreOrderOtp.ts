import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';
import { ORDER_OTP_PURPOSES } from '@/modules/connect-store-order/constants/order-status.js';
import {
  assertPaidForFulfillment,
  assertTransition,
  getOrderForTransition,
  resolveOrderCustomerEmail,
  sendOrderOtp,
} from '@/modules/connect-store-order/services/order-fulfillment.service.js';
import { logConnectStoreOrderActivity } from '@/modules/activity-log/services/activity-log.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    purpose: z.enum(ORDER_OTP_PURPOSES),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { purpose } = req.body as z.infer<typeof ValidationSchema.body>;

  if (purpose === 'complete' && req.user.role && !['admin', 'support'].includes(req.user.role)) {
    throw new ServerError('You do not have permission to send completion OTP');
  }

  if (purpose === 'delivered' && req.user.role && !['admin', 'warehouse'].includes(req.user.role)) {
    throw new ServerError('You do not have permission to send delivery OTP');
  }

  const order = await getOrderForTransition(db, id);
  if (!order) throw new ServerError('Order not found');

  assertPaidForFulfillment(order);

  if (purpose === 'delivered') {
    assertTransition(order, 'out_for_delivery', 'send delivery OTP');
  } else {
    assertTransition(order, 'delivered', 'send completion OTP');
  }

  const customerEmail = resolveOrderCustomerEmail(order);
  if (!customerEmail) {
    throw new ServerError('Customer email is required to send OTP');
  }

  const result = await sendOrderOtp(id, purpose, customerEmail, order.customer_name, {
    orderSerial: order.order_serial,
  });

  await logConnectStoreOrderActivity(db, req, {
    orderId: id,
    orderSerial: order.order_serial,
    action: 'otp_sent',
    metadata: {
      purpose,
      sent_to: result.sent_to,
    },
  });

  const isAdmin = req.user?.role === 'admin';

  return res.status(StatusCodes.OK).json({
    data: {
      message: 'OTP sent to customer email',
      sent_to: result.sent_to,
      customer_name: result.customer_name,
      ...(isAdmin ? { otp: result.otp } : {}),
    },
  });
}
