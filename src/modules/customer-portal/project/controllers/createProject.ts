import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createProject } from '@/modules/customer-portal/project/project.service.js';

export const ValidationSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;

  const {
    name,
    description,
    address,
    latitude,
    longitude,
  } = req.body as z.infer<typeof ValidationSchema.body>;

  const project = await createProject(
    { database: db },
    {
      user_id: customerId,
      name,
      description,
      address,
      latitude,
      longitude,
    },
  );

  return res.status(StatusCodes.OK).json(project);
}

