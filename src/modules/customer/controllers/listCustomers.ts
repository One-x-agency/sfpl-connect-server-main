import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
    search: z.string().trim().optional(),
    include_deleted: z.coerce.boolean().default(false),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const {
    limit, offset, search, include_deleted
  } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  let whereClause = ` WHERE role = 'customer' ${include_deleted ? '' : 'AND is_deleted = false'}`;

  if (search) whereClause += ' AND (email ILIKE $search OR name ILIKE $search OR phone_number ILIKE $search)';

  const customers = await db.namedQueryAll(
    `
      SELECT
        id,
        name,
        email,
        is_email_verified,
        phone_number,
        is_phone_number_verified,
        is_deleted,
        deleted_at,
        created_at,
        updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $limit
      OFFSET $offset
    `,
    {
      limit,
      offset,
      search : search ? `%${search}%` : null,
    },
  );

  return res.status(StatusCodes.OK).json(customers);
}
