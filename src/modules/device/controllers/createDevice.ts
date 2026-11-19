import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createDevice } from '@/modules/device/device.service.js';

export const ValidationSchema = {
  body: z.object({
    imei: z
      .string()
      .trim()
      .length(15, 'IMEI must be 15 characters'),
    name: z.string().trim().max(255).optional(),
    description: z.string().trim().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    user_id: z.uuid({ version: 'v7', message: 'Invalid user ID' }).nullable().optional(),
    firmware_version: z.string().trim().max(100).optional(),
    batch_number: z.string().trim().max(100).nullable().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const device = await createDevice({ database: db }, {
    imei: body.imei,
    name: body.name ?? null,
    description: body.description ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    user_id: body.user_id ?? req.auth?.userId ?? null,
    firmware_version: body.firmware_version ?? null,
    batch_number: body.batch_number ?? null,
  });

  return res.status(StatusCodes.OK).json({
    device,
  });
}

