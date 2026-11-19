import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import {
  deleteDeviceInputField,
  validateDeviceInputField,
} from '@/modules/customer-portal/device/services/deviceOperation.service.js';
import { Publisher } from '@/service/redis/index.js';

export const ValidationSchema = {
  params: z.object({
    input_field_id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { input_field_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const customerId = req.user.id;

  await validateDeviceInputField(
    { database: db },
    input_field_id,
    customerId,
  );

  const deletedField = await deleteDeviceInputField({ database: db }, input_field_id);

  if (!deletedField) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Input field not found' });

  await Publisher.publish('device:input_field:deleted', JSON.stringify({
    id: deletedField.id,
    device_id: deletedField.device_id,
  }));

  return res.status(StatusCodes.SUCCESS).send();
}

