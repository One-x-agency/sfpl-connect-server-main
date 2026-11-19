import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { sendSupportTicketCloseOtp } from '@/modules/support-ticket/support-ticket.service.js';

export const ValidationSchema = {
  params: z.object({
    ticket_id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { ticket_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const result = await sendSupportTicketCloseOtp(
    { database: db },
    ticket_id,
    req.user.id,
  );

  const isAdmin = req.user?.role === 'admin';

  return res.status(StatusCodes.OK).json({
    data: {
      sent_to: result.sent_to,
      customer_name: result.customer_name,
      ...(isAdmin ? { otp: result.otp } : {}),
    },
  });
}
