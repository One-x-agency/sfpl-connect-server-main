import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createDiagramImage } from '@/modules/customer-portal/diagram/diagram.service.js';

const configSchema = z.record(z.string(), z.any()).default({});

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    file_id: Schema.uuid(),
    config: configSchema.optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id: diagramId } = req.params as z.infer<typeof ValidationSchema.params>;
  const { file_id, config } = req.body as z.infer<typeof ValidationSchema.body>;

  const owned = await db.queryOne(
    'SELECT id FROM diagrams WHERE id = $1 AND created_by = $2',
    [diagramId, customerId],
  );

  if (!owned) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  const file = await db.queryOne('SELECT id FROM files WHERE id = $1', [file_id]);
  if (!file) return res.status(StatusCodes.NOT_FOUND).json({ message: 'File not found' });

  const row = await createDiagramImage(
    { database: db },
    {
      diagram_id: diagramId,
      file_id,
      config: config ?? {},
      created_by: customerId,
    },
  );

  return res.status(StatusCodes.OK).json(row);
}
