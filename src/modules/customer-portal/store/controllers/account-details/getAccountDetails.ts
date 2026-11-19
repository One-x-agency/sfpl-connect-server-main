import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { getCustomerStoreProfile } from '@/modules/customer-portal/store/services/customer-store-profile.service.js';

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user!.id;

  const accountDetails = await getCustomerStoreProfile(db, customerId);

  if (!accountDetails) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Customer not found' });
  }

  return res.status(StatusCodes.OK).json({ data: accountDetails });
}
