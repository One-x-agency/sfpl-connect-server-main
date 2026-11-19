import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { updateDevice } from '@/modules/device/device.service.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    id: z.string().uuid({ message: 'Invalid device ID' }),
  }),
  body: z.object({
    name: z.string().trim().max(255).optional(),
    description: z.string().trim().optional(),
    project_id: Schema.uuid().nullish(),
    latitude: z.number()
      .min(-90, 'Latitude must be >= -90')
      .max(90, 'Latitude must be <= 90').nullish(),
    longitude: z.number()
      .min(-180, 'Longitude must be >= -180')
      .max(180, 'Longitude must be <= 180').nullish(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const device = await updateDevice(
    { database: db },
    id,
    {
      name: body.name,
      description: body.description,
      project_id: body.project_id,
      user_id: customerId,
      latitude: body.latitude,
      longitude: body.longitude,
    },
  );

  return res.status(StatusCodes.OK).json({
    device,
  });
}

