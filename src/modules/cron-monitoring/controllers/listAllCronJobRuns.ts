import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { getTrackedCronJobs } from '@/core/cron/createCronJob.js';

export const ValidationSchema = {
  query: z.object({
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
    status: z.enum(['running', 'success', 'failed']).optional(),
    cron_job_key: z.string().trim().min(1).optional(),
  }),
};

interface CronJobRunRow {
  id: string;
  cron_job_key: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  trigger_reason: string;
  created_at: string;
}

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { limit, offset, status, cron_job_key: cronJobKey } = req.validatedQuery as z.infer<
    typeof ValidationSchema.query
  >;

  const conditions = ['1 = 1'];
  const params: Record<string, unknown> = { limit, offset };

  if (status) {
    conditions.push('status = $status');
    params.status = status;
  }

  if (cronJobKey) {
    conditions.push('cron_job_key = $cronJobKey');
    params.cronJobKey = cronJobKey;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const jobNames = new Map(
    [...getTrackedCronJobs().values()].map((job) => [job.key, job.name]),
  );

  const runs = await db.namedQueryAll<CronJobRunRow>(
    `
      SELECT
        id,
        cron_job_key,
        started_at,
        finished_at,
        duration_ms,
        status,
        error_message,
        trigger_reason,
        created_at
      FROM cron_job_runs
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT $limit
      OFFSET $offset
    `,
    params,
  );

  const countRow = await db.namedQueryOne<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM cron_job_runs
      ${whereClause}
    `,
    params,
  );

  return res.status(StatusCodes.OK).json({
    data: runs.map((run) => ({
      ...run,
      cron_job_name: jobNames.get(run.cron_job_key) ?? run.cron_job_key,
    })),
    meta: {
      total: countRow?.count ?? 0,
      limit,
      offset,
    },
  });
}
