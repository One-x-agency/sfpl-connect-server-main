import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

export const ValidationSchema = {
  query: z.object({
    device_id: Schema.uuid(),
    year: z.coerce.number().int().min(2000).max(2100),
  }),
};

interface DayAggregate {
  date: string;
  total_logs: number;
  healthy_logs: number;
  warning_logs: number;
  critical_logs: number;
}

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { device_id, year } = req.validatedQuery as z.infer<
    typeof ValidationSchema.query
  >;

  const fromDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const toDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const days = await db.namedQueryAll<DayAggregate>(
    `
    WITH logs AS (
      SELECT dl.timestamp, dl.status
      FROM device_logs dl
      WHERE dl.device_id = $device_id
        AND dl.timestamp >= $from_date::timestamptz
        AND dl.timestamp <= $to_date::timestamptz
    )
    SELECT
      TO_CHAR((l.timestamp AT TIME ZONE 'utc')::date, 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS total_logs,
      SUM((l.status = 'healthy')::int)::int AS healthy_logs,
      SUM((l.status = 'warning')::int)::int AS warning_logs,
      SUM((l.status = 'critical')::int)::int AS critical_logs
    FROM logs l
    GROUP BY (l.timestamp AT TIME ZONE 'utc')::date
    ORDER BY (l.timestamp AT TIME ZONE 'utc')::date ASC
    `,
    {
      device_id,
      from_date: fromDate.toISOString(),
      to_date: toDate.toISOString(),
    },
  );

  return res.status(StatusCodes.OK).json({
    data: {
      device_id,
      year,
      from_date: fromDate.toISOString(),
      to_date: toDate.toISOString(),
      days,
    },
  });
}

