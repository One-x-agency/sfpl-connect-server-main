import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { updateStaffStatus } from '@/modules/user/services/staff.service.js';

export const ValidationSchema = {
  params: z.object({
    staff_id: Schema.uuid(),
  }),
  body: z.object({
    is_active: z.boolean(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { staff_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { is_active } = req.body as z.infer<typeof ValidationSchema.body>;

  const staff = await updateStaffStatus(db, staff_id, is_active, req.user!.id);

  return res.status(StatusCodes.OK).json({ data: staff });
}
