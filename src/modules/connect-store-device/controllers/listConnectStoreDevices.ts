import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { listConnectStoreDevices } from '@/modules/connect-store-device/services/connect-store-device.service.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    offset: Schema.pagination.offset(),
    limit: Schema.pagination.limit(),
    search: z.string().trim().optional(),
    is_active: z.coerce.boolean().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const query = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> }).validatedQuery;
  const devices = await listConnectStoreDevices(db, query);
  return res.status(StatusCodes.OK).json({ data: devices });
}
