import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { getSupportTicketById } from '@/modules/customer-portal/support-ticket/support-ticket.service.js';

export const ValidationSchema = {
  params: z.object({
    ticket_id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { ticket_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const ticket = await getSupportTicketById(
    { database: db },
    ticket_id,
    customerId,
  );

  if (!ticket) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Ticket not found' });
  }

  return res.status(StatusCodes.OK).json({ data: ticket });
}
