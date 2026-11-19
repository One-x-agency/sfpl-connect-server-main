import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { getStaff } from '@/modules/user/services/staff.service.js';

export const ValidationSchema = {
  params: z.object({
    staff_id: Schema.uuid(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { staff_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const staff = await getStaff(db, staff_id);

  return res.status(StatusCodes.OK).json({ data: staff });
}
