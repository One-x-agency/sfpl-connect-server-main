import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const states = await db.queryAll('SELECT id, name, gst_code, is_union_territory FROM states ORDER BY name');
  return res.status(StatusCodes.OK).json({ data: states });
}
