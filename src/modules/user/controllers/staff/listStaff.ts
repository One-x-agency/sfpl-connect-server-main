import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { STAFF_ROLES } from '@/constants/user-role.js';
import { listStaff } from '@/modules/user/services/staff.service.js';

const staffRoleSchema = z.enum(STAFF_ROLES);

export const ValidationSchema = {
  query: z.object({
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
    search: z.string().trim().optional(),
    role: staffRoleSchema.optional(),
    include_deleted: z.coerce.boolean().default(false),
    is_active: z.coerce.boolean().optional(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const query = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  const staff = await listStaff(db, {
    limit: query.limit,
    offset: query.offset,
    search: query.search,
    role: query.role,
    include_deleted: query.include_deleted,
    is_active: query.is_active,
  });

  return res.status(StatusCodes.OK).json({ data: staff });
}
