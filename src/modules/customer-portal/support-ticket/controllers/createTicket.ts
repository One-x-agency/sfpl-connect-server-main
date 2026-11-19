import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createSupportTicket } from '@/modules/customer-portal/support-ticket/support-ticket.service.js';

export const ValidationSchema = {
  body: z.object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1),
    file_ids: z.array(Schema.uuid()).max(5).optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { title, description, file_ids } = req.body as z.infer<typeof ValidationSchema.body>;

  const ticket = await createSupportTicket(
    { database: db },
    {
      customer_id: customerId,
      title,
      description,
      file_ids,
    },
  );

  return res.status(StatusCodes.OK).json({ data: ticket });
}
