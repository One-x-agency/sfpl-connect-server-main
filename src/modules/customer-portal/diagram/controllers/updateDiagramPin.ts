import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { updateDiagramPin } from '@/modules/customer-portal/diagram/diagram.service.js';

const configSchema = z.record(z.string(), z.any());

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
    pin_id: Schema.uuid(),
  }),
  body: z.object({
    input_field_id: Schema.uuid().optional(),
    config: configSchema.optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const customerId = req.user.id;
  const { id: diagramId, pin_id } = req.params as z.infer<typeof ValidationSchema.params>;
  const { input_field_id, config } = req.body as z.infer<typeof ValidationSchema.body>;

  if (input_field_id !== undefined) {
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
  }

  const updated = await updateDiagramPin(
    { database: db },
    pin_id,
    diagramId,
    customerId,
    { input_field_id, config },
  );

  if (!updated) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Diagram pin not found' });

  return res.status(StatusCodes.OK).json(updated);
}
