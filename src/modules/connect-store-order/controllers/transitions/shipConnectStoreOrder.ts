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
  assignDevicesToOrder,
  getOrderForTransition,
  mergeStatusDetails,
  updateOrderStatus,
} from '@/modules/connect-store-order/services/order-fulfillment.service.js';
import { createStoreInvoiceForOrder } from '@/modules/connect-store-order/services/create-store-invoice.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    docket_number: z.string().trim().min(1).max(100),
    delivery_partner: z.string().trim().min(1).max(100),
    device_ids: z.array(Schema.uuid()).min(1).max(500),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { docket_number, delivery_partner, device_ids } = req.body as z.infer<typeof ValidationSchema.body>;

  const order = await getOrderForTransition(db, id);
  if (!order) throw new ServerError('Order not found');

  assertPaidForFulfillment(order);
  assertTransition(order, 'processing', 'ship');

  await db.begin();
  try {
    const assignedDeviceIds = await assignDevicesToOrder(db, id, order.customer_id, device_ids);

    await mergeStatusDetails(db, id, 'shipping', {
      docket_number,
      delivery_partner,
      device_ids: assignedDeviceIds,
      submitted_at: new Date().toISOString(),
      submitted_by: req.user?.id ?? null,
    });

    const updated = await updateOrderStatus(
      db,
      id,
      'out_for_delivery',
      req.user?.id,
      {
        docketNumber: docket_number,
        deliveryPartner: delivery_partner,
      },
    );

    await logConnectStoreOrderActivity(db, req, {
      orderId: id,
      orderSerial: order.order_serial,
      action: 'status_change',
      metadata: {
        from_status: 'processing',
        to_status: 'out_for_delivery',
        docket_number,
        delivery_partner,
        device_ids: assignedDeviceIds,
      },
    });

    const invoice = await createStoreInvoiceForOrder(db, id);
    await db.commit();

    return res.status(StatusCodes.OK).json({
      data: {
        ...updated,
        invoice,
        assigned_device_ids: assignedDeviceIds,
      },
    });
  } catch (error) {
    await db.rollback();
    throw error;
  }
}
