import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import ServerError from '@/core/serverError.class.js';
import { getConnectStoreDeviceById } from '@/modules/connect-store-device/services/connect-store-device.service.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const device = await getConnectStoreDeviceById(db, id);
  if (!device) throw new ServerError('Connect device not found');
  return res.status(StatusCodes.OK).json({ data: device });
}
