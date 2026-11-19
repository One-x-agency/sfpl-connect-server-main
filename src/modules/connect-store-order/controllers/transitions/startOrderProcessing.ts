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
} from '@/modules/connect-store-order/services/order-fulfillment.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    remark: z.string().trim().min(1).max(2000),
    todo: z.string().trim().min(1).max(2000),
    building_name: z.string().trim().min(1).max(255),
    floor: z.string().trim().min(1).max(100),
    building_type: z.string().trim().min(1).max(100),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const order = await getOrderForTransition(db, id);
  if (!order) throw new ServerError('Order not found');

  assertPaidForFulfillment(order);
  assertTransition(order, 'pending', 'start processing');

  const processingDetails = {
    remark: body.remark,
    todo: body.todo,
    building_name: body.building_name,
    floor: body.floor,
    building_type: body.building_type,
    submitted_at: new Date().toISOString(),
    submitted_by: req.user?.id ?? null,
  };

  await mergeStatusDetails(db, id, 'processing', processingDetails);
  const updated = await updateOrderStatus(db, id, 'processing', req.user?.id);

  await logConnectStoreOrderActivity(db, req, {
    orderId: id,
    orderSerial: order.order_serial,
    action: 'status_change',
    metadata: {
      from_status: 'pending',
      to_status: 'processing',
    },
  });

  return res.status(StatusCodes.OK).json({ data: updated });
}
