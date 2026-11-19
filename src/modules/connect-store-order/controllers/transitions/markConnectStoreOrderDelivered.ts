import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import Schema from '@/config/validationSchema.js';
import { logConnectStoreOrderActivity } from '@/modules/activity-log/services/activity-log.service.js';
import {
  assertPaidForFulfillment,
  assertTransition,
  getOrderForTransition,
  mergeStatusDetails,
  updateOrderStatus,
  verifyOrderOtp,
} from '@/modules/connect-store-order/services/order-fulfillment.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    remark: z.string().trim().max(2000).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { otp, remark } = req.body as z.infer<typeof ValidationSchema.body>;

  const order = await getOrderForTransition(db, id);
  if (!order) throw new ServerError('Order not found');

  assertPaidForFulfillment(order);
  assertTransition(order, 'out_for_delivery', 'mark as delivered');

  await verifyOrderOtp(id, 'delivered', otp);

  await logConnectStoreOrderActivity(db, req, {
    orderId: id,
    orderSerial: order.order_serial,
    action: 'otp_verified',
    metadata: { purpose: 'delivered' },
  });

  const deliveredDetails: Record<string, unknown> = {
    otp_verified_at: new Date().toISOString(),
  };
  if (remark) deliveredDetails.remark = remark;

  await mergeStatusDetails(db, id, 'delivered', deliveredDetails);
  const updated = await updateOrderStatus(db, id, 'delivered', req.user?.id);

  await logConnectStoreOrderActivity(db, req, {
    orderId: id,
    orderSerial: order.order_serial,
    action: 'status_change',
    metadata: {
      from_status: 'out_for_delivery',
      to_status: 'delivered',
    },
  });

  return res.status(StatusCodes.OK).json({ data: updated });
}
