import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {

  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const project = await db.queryOne(
    `
      SELECT
        id,
        user_id as customer_id,
        name,
        description,
        address,
        latitude,
        longitude,
        created_at,
        updated_at
      FROM projects
      WHERE id = $1
    `,
    [id],
  );

  if (!project) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });

  return res.status(StatusCodes.OK).json(project);
}

