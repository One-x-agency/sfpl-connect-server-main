import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import {
  storeCustomerProfileSchema,
  updateCustomerStoreProfile,
} from '@/modules/customer-portal/store/services/customer-store-profile.service.js';

export const ValidationSchema = {
  body: storeCustomerProfileSchema,
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user!.id;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const saved = await updateCustomerStoreProfile(db, customerId, body);

  if (!saved) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });
  }

  return res.status(StatusCodes.OK).json({ data: saved });
}
