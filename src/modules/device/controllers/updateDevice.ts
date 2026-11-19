import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { updateDevice, findDeviceById } from '@/modules/device/device.service.js';
import { denyQcAssigned } from '@/modules/device/device-qc-access.js';

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().optional(),
    sim_card_id: z
      .uuid({ version: 'v7', message: 'Invalid SIM card ID' })
      .nullable()
      .optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    user_id: z.uuid({ version: 'v7', message: 'Invalid user ID' }).nullable().optional(),
    firmware_version: z.string().trim().max(100).optional(),
    batch_number: z.string().trim().max(100).nullable().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const existingDevice = await findDeviceById({ database: db }, id);
  if (!existingDevice) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  if (denyQcAssigned(res, req.user?.role, existingDevice.user_id)) {
    return undefined;
  }

  const device = await updateDevice({ database: db }, id, {
    // Important: when a field is omitted from the request body, keep it unchanged.
    // `updateDeviceService` only updates columns when the corresponding input field is `!== undefined`.
    name: body.name,
    description: body.description,
    sim_card_id: body.sim_card_id,
    latitude: body.latitude,
    longitude: body.longitude,
    user_id: body.user_id,
    firmware_version: body.firmware_version,
    batch_number: body.batch_number,
  });

  return res.status(StatusCodes.OK).json({
    device,
  });
}

