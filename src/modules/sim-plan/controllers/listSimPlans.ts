import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';

import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { search, limit, offset } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  let whereClause = ' WHERE TRUE ';

  if (search) {
    whereClause += `
      AND (
        name ILIKE $search
        OR sms_limit::text ILIKE $search
        OR data_limit::text ILIKE $search
        OR call_limit::text ILIKE $search
        OR subscription_amount::text ILIKE $search
        OR remark ILIKE $search
      )
    `;
  }

  const simPlans = await db.namedQueryAll(
    `
      SELECT
        id,
        name,
        sms_limit,
        data_limit,
        call_limit,
        subscription_amount,
        remark,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM sim_plans
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $limit
      OFFSET $offset
    `,
    {
      search: search ? `%${search}%` : null,
      limit,
      offset,
    },
  );

  return res.status(StatusCodes.OK).json(simPlans);
}
