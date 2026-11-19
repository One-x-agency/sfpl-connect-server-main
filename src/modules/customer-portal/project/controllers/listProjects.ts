import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';


export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;


  const projects = await db.queryAll(
    `
      SELECT
        p.id,
        p.user_id,
        p.name,
        p.description,
        p.address,
        p.latitude,
        p.longitude,
        p.created_at,
        p.updated_at,
        COUNT(d.id) AS device_count
      FROM projects p
      LEFT JOIN devices d ON d.project_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
    [customerId],
  );

  return res.status(StatusCodes.OK).json(projects);
}

