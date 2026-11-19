import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user!.id;

  const addresses = await db.queryAll(
    `SELECT
      a.id,
      a.type,
      a.address,
      a.city,
      a.postal_code,
      a.state_id,
      s.name AS state_name,
      s.gst_code AS state_gst_code
     FROM connect_store_addresses a
     JOIN states s ON s.id = a.state_id
     WHERE a.customer_id = $1`,
    [customerId],
  );

  return res.status(StatusCodes.OK).json({ data: addresses });
}
