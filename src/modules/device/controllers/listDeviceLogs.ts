import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { flattenDeviceLogRow } from '@/modules/device/utils/flattenDeviceLog.js';

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  query: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(50000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }).refine((data) => data.from && data.to ? data.from < data.to : true, {
    message: 'From date must be before to date',
    path: ['from', 'to'],
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const {
    from,
    to,
    limit,
    offset,
  } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  const { id : device_id } = req.params as z.infer<typeof ValidationSchema.params>;

  const effectiveFrom = from;
  const effectiveTo =  to;

  let whereClause = ' WHERE TRUE ';
  let offsetLimitClause = '';
  if(offset) offsetLimitClause += ' OFFSET $offset ';
  if(limit) offsetLimitClause += ' LIMIT $limit ';

  if (device_id) whereClause += ' AND dl.device_id = $device_id ';
  if (effectiveFrom) whereClause += ' AND dl.timestamp >= $from ';
  if (effectiveTo) whereClause += ' AND dl.timestamp <= $to ';

  const logs = await db.namedQueryAll(
    `
    SELECT
      dl.timestamp,
      dl.status,
      dl.data,
      dl.created_at
    FROM device_logs dl
    ${whereClause}
    ORDER BY dl.timestamp DESC, dl.created_at DESC
    ${offsetLimitClause}
    `,
    {
      from,
      to,
      limit,
      offset,
      device_id,
    },
  );

  const processedLogs = logs.map((log) => flattenDeviceLogRow(log));

  return res.status(StatusCodes.OK).json(processedLogs);
}

