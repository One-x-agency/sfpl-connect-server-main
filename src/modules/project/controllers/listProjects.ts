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
    customer_id: Schema.uuid().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {

  const {
    limit, offset, search, customer_id
  } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  let whereClause = ' WHERE TRUE ';
  if (search) whereClause += ' AND name ILIKE $search';
  if (customer_id) whereClause += ' AND user_id = $user_id';


  const result = await db.namedQueryAll(
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
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $limit
      OFFSET $offset
    `,
    {
      limit,
      offset,
      search: search ? `%${search}%` : null,
      user_id: customer_id,
    },
  );

  return res.status(StatusCodes.OK).json(result);
}

