import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

import { copyDeviceConfig } from '@/modules/customer-portal/device/services/deviceOperation.service.js';

export const ValidationSchema = {
  body: z.object({
    current_device_id: Schema.uuid(),
    reference_device_id: Schema.uuid(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const {
    current_device_id,
    reference_device_id,
  } = req.body as z.infer<typeof ValidationSchema.body>;

  const result = await copyDeviceConfig(
    { database: db },
    {
      current_device_id,
      reference_device_id,
    },
  );

  return res.status(StatusCodes.OK).json(result);
}

