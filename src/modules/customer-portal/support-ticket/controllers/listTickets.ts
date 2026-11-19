import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { TICKET_STATUSES } from '@/modules/customer-portal/support-ticket/constants/ticket-status.js';
import { listSupportTickets } from '@/modules/customer-portal/support-ticket/support-ticket.service.js';

export const ValidationSchema = {
  query: z.object({
    offset: Schema.pagination.offset(),
    limit: Schema.pagination.limit(),
    status: z.enum(TICKET_STATUSES).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const query = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> }).validatedQuery;

  const tickets = await listSupportTickets(
    { database: db },
    customerId,
    {
      offset: query.offset,
      limit: query.limit,
      status: query.status,
    },
  );

  res.set('Cache-Control', 'no-store');
  return res.status(StatusCodes.OK).json({ data: tickets });
}
