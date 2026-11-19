import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { getCustomerStoreCart } from '@/modules/customer/services/customer-cart.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  void next;
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const cart = await getCustomerStoreCart(db, id);
  return res.status(StatusCodes.OK).json({ data: cart });
}
