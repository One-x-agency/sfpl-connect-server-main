import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { STAFF_ROLES } from '@/constants/user-role.js';
import { updateStaff } from '@/modules/user/services/staff.service.js';

const staffRoleSchema = z.enum(STAFF_ROLES);

export const ValidationSchema = {
  params: z.object({
    staff_id: Schema.uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(2).max(255),
    email: Schema.email(),
    phone_number: Schema.phoneNumber().optional().nullable(),
    role: staffRoleSchema,
    password: z.string().trim().min(5).max(255).optional(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { staff_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  const staff = await updateStaff(
    db,
    staff_id,
    {
      name: body.name,
      email: body.email,
      phone_number: body.phone_number ?? null,
      role: body.role,
      password: body.password,
    },
    req.user!.id,
  );

  return res.status(StatusCodes.OK).json({ data: staff });
}
