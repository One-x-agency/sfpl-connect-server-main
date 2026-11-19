import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    device_id: Schema.uuid(),
    from_date: z.string().min(1).optional(),
    to_date: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(3000),
  }),
};

interface InputFieldRow {
  id: string;
  device_id: string;
  io_pin: string;
  name: string;
  unit: string | null;
  conversation_factor: number;
}

interface LogRow {
  timestamp: Date;
  data: Record<string, unknown> | null;
}

function getPinValue(
  data: Record<string, unknown> | null,
  inputField: InputFieldRow,
): number | null {
  if (!data || typeof data !== 'object') return null;
  const byId = data[inputField.id] as { value?: number } | undefined;
  const byIoPin = data[inputField.io_pin];
  if (byId && typeof byId === 'object' && typeof byId.value === 'number') {
    return byId.value;
  }
  if (byIoPin !== undefined && byIoPin !== null) {
    const n = typeof byIoPin === 'number' ? byIoPin : Number(byIoPin);
    if (!Number.isNaN(n)) return n * inputField.conversation_factor;
  }
  return null;
}

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { device_id, from_date, to_date, limit } = req.validatedQuery as z.infer<
    typeof ValidationSchema.query
  >;

  const inputFields = await db.namedQueryAll<InputFieldRow>(
    `
    SELECT id, device_id, io_pin, name, unit, conversation_factor
    FROM device_input_fields
    WHERE device_id = $device_id
    ORDER BY created_at ASC
    `,
    { device_id },
  );

  const conditions: string[] = ['dl.device_id = $device_id'];
  const params: Record<string, unknown> = {
    device_id,
    limit,
  };

  if (from_date) {
    params.from_date = from_date;
    conditions.push('dl.timestamp >= $from_date::timestamptz');
  }
  if (to_date) {
    params.to_date = to_date;
    conditions.push('dl.timestamp <= $to_date::timestamptz');
  }

  const whereClause = conditions.join(' AND ');

    const rows = await db.namedQueryAll<LogRow>(
    `
    SELECT dl.timestamp, dl.data
    FROM device_logs dl
    WHERE ${whereClause}
    ORDER BY dl.timestamp DESC
    LIMIT $limit
    `,
    params,
  );


  const series = rows
    .map((row) => {
      const pins: Record<string, number | null> = {};
      for (const inputField of inputFields) {
        pins[inputField.id] = getPinValue(row.data, inputField);
      }
      return {
        timestamp: row.timestamp,
        pins,
      };
    })
    .reverse();

  return res.status(StatusCodes.OK).json({
    data: {
      device_id,
      input_fields: inputFields.map((f) => ({
        id: f.id,
        device_id: f.device_id,
        io_pin: f.io_pin,
        name: f.name,
        unit: f.unit,
      })),
      series,
    },
  });
}
