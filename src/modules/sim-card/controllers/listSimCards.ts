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
    is_attached: z
      .preprocess((value) => {
        if (typeof value === 'string') {
          const lowered = value.toLowerCase();

          if (lowered === 'true') return true;
          if (lowered === 'false') return false;
        }

        return value;
      }, z.boolean())
      .optional(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const {
    search,
    limit,
    offset,
    is_attached,
  } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  let whereClause = ' WHERE TRUE ';

  if (search) {
    whereClause += `
      AND (
        sc.number ILIKE $search
        OR sc.imsi_number ILIKE $search
      )
    `;
  }

  if (is_attached !== undefined) {
    whereClause += ' AND ((d.id IS NOT NULL) = $is_attached) ';
  }

  const simCards = await db.namedQueryAll(
    `
      SELECT
        sc.*,
        sp.name AS sim_plan_name,
        sp.sms_limit,
        sp.data_limit,
        sp.call_limit,
        sp.subscription_amount,

        (d.id IS NOT NULL) AS is_attached,

        jsonb_build_object(
          'id', d.id,
          'imei', d.imei,
          'name', d.name
        ) AS device

      FROM sim_cards sc
      LEFT JOIN devices d ON d.sim_card_id = sc.id
      LEFT JOIN sim_plans sp ON sp.id = sc.sim_plan_id

      ${whereClause}

      ORDER BY sc.created_at DESC
      LIMIT $limit
      OFFSET $offset
    `,
    {
      search: search ? `%${search}%` : null,
      limit,
      offset,
      is_attached,
    },
  );

  return res.status(StatusCodes.OK).json(simCards);
}
