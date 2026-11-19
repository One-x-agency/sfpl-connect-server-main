import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import { mergeGuestCartIntoCustomer } from '@/modules/customer-portal/store/services/cart.service.js';

export const ValidationSchema = {
  body: z.object({
    guest_cart_id: z.uuid({ version: 'v7' }),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user?.id;
  if (!customerId) throw new ServerError('Login required');

  const { guest_cart_id } = req.body as z.infer<typeof ValidationSchema.body>;
  await mergeGuestCartIntoCustomer(db, guest_cart_id, customerId);

  return res.status(StatusCodes.OK).json({ data: { merged: true } });
}
