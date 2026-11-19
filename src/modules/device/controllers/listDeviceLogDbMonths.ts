import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { deviceExists } from '@/modules/device/services/deviceLogArchive.service.js';
import { listDeviceLogDbExportMonths } from '@/modules/device/services/deviceLogDbExport.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id: deviceId } = req.params as z.infer<typeof ValidationSchema.params>;

  const exists = await deviceExists(db, deviceId);
  if (!exists) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  const months = await listDeviceLogDbExportMonths(db, deviceId);

  return res.status(StatusCodes.OK).json({ data: months });
}
