import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { updateProject } from '@/modules/customer-portal/project/project.service.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().nullish().optional(),
    address: z.string().trim().nullish().optional(),
    latitude: z.number().nullish().optional(),
    longitude: z.number().nullish().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const {
    name,
    description,
    address,
    latitude,
    longitude,
  } = req.body as z.infer<typeof ValidationSchema.body>;

  await updateProject(
    { database: db },
    id,
    {
      customer_id: customerId,
      name,
      description,
      address,
      latitude,
      longitude,
    },
  );

  return res.status(StatusCodes.SUCCESS).send();
}

