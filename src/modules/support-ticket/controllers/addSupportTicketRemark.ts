import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { addSupportTicketRemark } from '@/modules/support-ticket/support-ticket.service.js';

export const ValidationSchema = {
  params: z.object({
    ticket_id: Schema.uuid(),
  }),
  body: z.object({
    remark: z.string().trim().min(1).max(2000),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { ticket_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { remark } = req.body as z.infer<typeof ValidationSchema.body>;

  const created = await addSupportTicketRemark(
    { database: db },
    ticket_id,
    {
      remark,
      created_by: req.user.id,
    },
  );

  return res.status(StatusCodes.OK).json({ data: created });
}
