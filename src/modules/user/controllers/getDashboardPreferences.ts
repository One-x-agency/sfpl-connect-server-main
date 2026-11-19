import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { getDashboardPreferences } from '@/modules/user/user.service.js';

export const ValidationSchema = {
  query: z.object({
    page: Schema.dashboardPreferences.page().default('overview'),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { page } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
  const userId = req.user!.id;

  const preference = await getDashboardPreferences(
    { database: db },
    userId,
    page,
  );

  return res.status(StatusCodes.OK).json({
    data: preference,
  });
}
