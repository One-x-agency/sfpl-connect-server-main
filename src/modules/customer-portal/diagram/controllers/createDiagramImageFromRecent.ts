import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { duplicateFileRecord } from '@/modules/file/file.service.js';
import { createDiagramImage } from '@/modules/customer-portal/diagram/diagram.service.js';

const configSchema = z.record(z.string(), z.any()).optional();

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    source_diagram_image_id: Schema.uuid(),
    config: configSchema,
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id: diagramId } = req.params as z.infer<typeof ValidationSchema.params>;
  const { source_diagram_image_id, config } = req.body as z.infer<typeof ValidationSchema.body>;

  const owned = await db.queryOne(
    'SELECT id FROM diagrams WHERE id = $1 AND created_by = $2',
    [diagramId, customerId],
  );

  if (!owned) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  const source = await db.queryOne<{
    file_id: string;
    original_image_id: string;
  }>(
    `
      SELECT di.file_id, di.original_image_id
      FROM diagram_images di
      INNER JOIN diagrams d ON d.id = di.diagram_id AND d.created_by = $2
      WHERE di.id = $1
    `,
    [source_diagram_image_id, customerId],
  );

  if (!source) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Source image not found' });
  }

  const newFile = await duplicateFileRecord({ database: db }, { sourceFileId: source.file_id });

  const row = await createDiagramImage(
    { database: db },
    {
      diagram_id: diagramId,
      file_id: newFile.id,
      original_image_id: source.original_image_id,
      config: config ?? {},
      created_by: customerId,
    },
  );

  return res.status(StatusCodes.OK).json(row);
}
