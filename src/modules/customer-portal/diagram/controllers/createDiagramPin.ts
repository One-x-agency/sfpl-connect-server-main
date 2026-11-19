import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { createDiagramPin } from '@/modules/customer-portal/diagram/diagram.service.js';

const configSchema = z.record(z.string(), z.any()).default({});

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    input_field_id: Schema.uuid(),
    config: configSchema.optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id: diagramId } = req.params as z.infer<typeof ValidationSchema.params>;
  const { input_field_id, config } = req.body as z.infer<typeof ValidationSchema.body>;

  const owned = await db.queryOne(
    'SELECT id FROM diagrams WHERE id = $1 AND created_by = $2',
    [diagramId, customerId],
  );

  if (!owned) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram not found' });

  const fieldOk = await db.queryOne(
    `
      SELECT dif.id
      FROM device_input_fields dif
      INNER JOIN devices d ON d.id = dif.device_id
      WHERE dif.id = $1
        AND d.user_id = $2
    `,
    [input_field_id, customerId],
  );

  if (!fieldOk) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device input field not found' });
  }

  const pin = await createDiagramPin(
    { database: db },
    {
      diagram_id: diagramId,
      input_field_id,
      config: config ?? {},
    },
  );

  return res.status(StatusCodes.OK).json(pin);
}
