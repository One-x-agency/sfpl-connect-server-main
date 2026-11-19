import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { listStoreDevices } from '@/modules/customer-portal/store/services/store-device.service.js';

export const ValidationSchema = {
  query: z.object({
    offset: Schema.pagination.offset(),
    limit: z.coerce.number().int().min(1).max(100).default(12),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const query = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> }).validatedQuery;

  const devices = await listStoreDevices(db, {
    offset: query.offset,
    limit: query.limit,
  });

  return res.status(StatusCodes.OK).json({ data: devices });
}
