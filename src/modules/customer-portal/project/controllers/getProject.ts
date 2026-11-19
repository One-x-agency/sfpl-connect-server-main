import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const project = await db.queryOne(
    `
      SELECT
        id,
        user_id,
        name,
        description,
        address,
        latitude,
        longitude,
        created_at,
        updated_at
      FROM projects
      WHERE id = $1
      AND user_id = $2
    `,
    [id, customerId],
  );

  if (!project) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });

  return res.status(StatusCodes.OK).json(project);
}

