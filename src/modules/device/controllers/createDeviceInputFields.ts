import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

import { createDeviceInputField, findDeviceById } from '@/modules/device/device.service.js';
import { denyQcAssigned } from '@/modules/device/device-qc-access.js';

import DeviceValidation from '@/modules/device/device.validation.js';
import Schema from '@/config/validationSchema.js';

import { Publisher } from '@/service/redis/index.js';


export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    io_pin: DeviceValidation.io_pin(),
    name: z.string().trim().max(255),
    description: z.string().trim().nullish(),
    conversation_factor: z.number().default(1),
    calibration: DeviceValidation.calibration(),
    validation: DeviceValidation.validation().nullish(),
    unit: z.string().trim().max(30).nullish(),
    priority: z.number().int().min(0).default(0),
  }),
};


export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient
) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const device = await findDeviceById({ database: db }, id);
  if (!device) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  if (denyQcAssigned(res, req.user?.role, device.user_id)) {
    return undefined;
  }

  const {
    io_pin, name, description, conversation_factor, calibration, validation, unit, priority
  } = req.body as z.infer<typeof ValidationSchema.body>;

  const inputField = await createDeviceInputField(
    { database: db },
    {
      device_id: id,
      io_pin,
      name,
      description,
      conversation_factor,
      calibration,
      validation,
      unit,
      priority,
    }
  );


  await Publisher.publish('device:input_field:created', JSON.stringify({
    id: inputField.id,
    device_id: id,
  }));


  return res.status(StatusCodes.OK).json({
    input_field: inputField,
  });
}
