import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import { getStoreDeviceBySlug } from '@/modules/customer-portal/store/services/store-device.service.js';

export const ValidationSchema = {
  params: z.object({
    slug: z.string().trim().min(1).max(255),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { slug } = req.params as z.infer<typeof ValidationSchema.params>;
  const device = await getStoreDeviceBySlug(db, slug);
  if (!device) throw new ServerError('Connect device not found');
  return res.status(StatusCodes.OK).json({ data: device });
}
