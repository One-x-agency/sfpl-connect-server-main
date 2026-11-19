import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { Publisher } from '@/service/redis/index.js';
import { updateDeviceInputField } from '@/modules/device/device.service.js';
import { denyQcAssigned, getInputFieldDeviceUserId } from '@/modules/device/device-qc-access.js';
import DeviceValidation from '@/modules/device/device.validation.js';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    input_field_id: Schema.uuid(),
  }),
  body: z.object({
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
  const { input_field_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const deviceRef = await getInputFieldDeviceUserId(db, input_field_id);
  if (!deviceRef) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Input field not found' });
  }

  if (denyQcAssigned(res, req.user?.role, deviceRef.user_id)) {
    return undefined;
  }

  const {
    name, description, conversation_factor, calibration, validation, unit, priority
  } = req.body as z.infer<typeof ValidationSchema.body>;


  const inputField = await updateDeviceInputField(
    { database: db },
    input_field_id,
    {
      name,
      description,
      conversation_factor,
      calibration,
      validation,
      unit,
      priority,
    }
  );

  await Publisher.publish('device:input_field:updated', JSON.stringify({
    id: inputField.id,
    device_id: inputField.device_id,
  }));

  return res.status(StatusCodes.OK).json({
    input_field: inputField,
  });
}
