import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { TICKET_STATUSES } from '@/modules/support-ticket/constants/ticket-status.js';
import { listSupportTickets } from '@/modules/support-ticket/support-ticket.service.js';

export const ValidationSchema = {
  query: z.object({
    offset: Schema.pagination.offset(),
    limit: Schema.pagination.limit(),
    search: z.string().trim().optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    customer_id: Schema.uuid().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const query = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> }).validatedQuery;

  const tickets = await listSupportTickets(
    { database: db },
    {
      offset: query.offset,
      limit: query.limit,
      search: query.search,
      status: query.status,
      customer_id: query.customer_id,
    },
  );

  return res.status(StatusCodes.OK).json({ data: tickets });
}
