import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { findDeviceById } from '@/modules/device/device.service.js';
import { publishTopic } from '@/mqttClient.js';

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const device = await findDeviceById({ database: db }, id);

  if (!device) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  const data = await publishTopic(`device/${device.imei}/configuration/get`, null, {
    ackTopic: 'device/configuration',
  });

  return res.status(StatusCodes.OK).json(data);
}
