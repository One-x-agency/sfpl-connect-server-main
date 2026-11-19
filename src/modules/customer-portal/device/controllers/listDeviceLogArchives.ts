import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import {
  customerOwnsDevice,
  listDeviceLogArchivesForDevice,
} from '@/modules/device/services/deviceLogArchive.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id: deviceId } = req.params as z.infer<typeof ValidationSchema.params>;
  const customerId = req.user.id;

  const owns = await customerOwnsDevice(db, deviceId, customerId);
  if (!owns) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  const archives = await listDeviceLogArchivesForDevice(db, deviceId, customerId);

  return res.status(StatusCodes.OK).json({ data: archives });
}
