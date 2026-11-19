import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

import { createJWTToken } from '@/utility/token.js';

async function getDiagramAccessToken(userId: string) {
  return createJWTToken({ type: 'diagram_access_token', user_id: userId }, '3h');
}
export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;

  const diagrams = await db.queryAll(
    `
      SELECT
        id,
        name,
        created_at,
        updated_at
      FROM diagrams
      WHERE created_by = $1
      ORDER BY created_at DESC
    `,
    [customerId],
  );

  const diagramAccessToken = await getDiagramAccessToken(customerId);

  diagrams.forEach(diagram => {
    diagram.access_token = diagramAccessToken;
  });

  return res.status(StatusCodes.OK).json(diagrams);
}
