import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import ServerError from '@/core/serverError.class.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { TICKET_STATUSES } from '@/modules/support-ticket/constants/ticket-status.js';
import { updateSupportTicket } from '@/modules/support-ticket/support-ticket.service.js';

export const ValidationSchema = {
  params: z.object({
    ticket_id: Schema.uuid(),
  }),
  body: z.object({
    status: z.enum(TICKET_STATUSES).optional(),
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits').optional(),
  }).refine((body) => body.status !== undefined, {
    message: 'Status is required',
  }).refine((body) => body.status !== 'closed' || !!body.otp, {
    message: 'OTP is required to close ticket',
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { ticket_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;

  if (body.status === 'open') {
    throw new ServerError('Reopening closed tickets is not supported.');
  }

  const ticket = await updateSupportTicket(
    { database: db },
    ticket_id,
    {
      status: body.status,
      otp: body.otp,
    },
    req.user.id,
  );

  return res.status(StatusCodes.OK).json({ data: ticket });
}
