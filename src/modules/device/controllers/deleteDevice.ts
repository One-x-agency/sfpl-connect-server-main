import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { deleteDevice } from '@/modules/device/device.service.js';
import Schema from '@/config/validationSchema.js';
import Redis from '@/service/redis/index.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const deletedDevice = await deleteDevice({ database: db }, id);

  if (!deletedDevice) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });

  await Redis.del(`device:imei:${deletedDevice.imei}`);

  return res.status(StatusCodes.SUCCESS).send();
}

