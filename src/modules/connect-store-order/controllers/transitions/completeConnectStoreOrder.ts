import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';
import {
  assertPaidForFulfillment,
  assertTransition,
  getOrderForTransition,
  mergeStatusDetails,
  updateOrderStatus,
  verifyOrderOtp,
} from '@/modules/connect-store-order/services/order-fulfillment.service.js';
import { logConnectStoreOrderActivity } from '@/modules/activity-log/services/activity-log.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { otp } = req.body as z.infer<typeof ValidationSchema.body>;

  const order = await getOrderForTransition(db, id);
  if (!order) throw new ServerError('Order not found');

  assertPaidForFulfillment(order);
  assertTransition(order, 'delivered', 'complete');

  await verifyOrderOtp(id, 'complete', otp);

  await logConnectStoreOrderActivity(db, req, {
    orderId: id,
    orderSerial: order.order_serial,
    action: 'otp_verified',
    metadata: { purpose: 'complete' },
  });

  await mergeStatusDetails(db, id, 'complete', {
    otp_verified_at: new Date().toISOString(),
  });
  const updated = await updateOrderStatus(db, id, 'complete', req.user?.id);

  await logConnectStoreOrderActivity(db, req, {
    orderId: id,
    orderSerial: order.order_serial,
    action: 'status_change',
    metadata: {
      from_status: 'delivered',
      to_status: 'complete',
    },
  });

  return res.status(StatusCodes.OK).json({ data: updated });
}
