import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { clearCustomerAuthCookies } from '@/utility/customerAuthCookies.js';

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  void req;
  void next;
  void db;

  clearCustomerAuthCookies(res);

  return res.status(StatusCodes.OK).json({ message: 'Logged out successfully' });
}
