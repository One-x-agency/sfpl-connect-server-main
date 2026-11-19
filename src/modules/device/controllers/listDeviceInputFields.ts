import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  const inputFields = await db.queryAll(
    `
      SELECT
        id,
        device_id,
        io_pin,
        name,
        description,
        conversation_factor,
        calibration,
        validation,
        unit,
        priority,
        created_at
      FROM device_input_fields
      WHERE device_id = $1
      ORDER BY priority ASC, created_at ASC
    `,
    [id],
  );

  return res.status(StatusCodes.OK).json(inputFields);
}

