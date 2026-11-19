import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id: diagramId } = req.params as z.infer<typeof ValidationSchema.params>;

  const owned = await db.queryOne(
    'SELECT id FROM diagrams WHERE id = $1 AND created_by = $2',
    [diagramId, customerId],
  );

  if (!owned) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  const pins = await db.queryAll(
    `
      SELECT
        dp.id,
        dp.diagram_id,
        dp.input_field_id,
        dp.config
      FROM diagram_pins dp
      WHERE dp.diagram_id = $1
      ORDER BY dp.id ASC
    `,
    [diagramId],
  );

  return res.status(StatusCodes.OK).json(pins);
}
