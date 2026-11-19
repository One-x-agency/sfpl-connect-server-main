import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { device_io_pin_options } from '@/config/constant.js';

export const ValidationSchema = {};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  void req;
  void next;
  void db;

  return res.status(StatusCodes.OK).json(device_io_pin_options);
}
