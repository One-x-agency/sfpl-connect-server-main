import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import ServerError from '@/core/serverError.class.js';
import { getTrackedCronJob } from '@/core/cron/createCronJob.js';

export const ValidationSchema = {
  params: z.object({
    cron_job_key: z.string().trim().min(1, 'Cron job key is required'),
  }),
  query: z.object({
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
    status: z.enum(['running', 'success', 'failed']).optional(),
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
  const { cron_job_key: cronJobKey } = req.params as z.infer<typeof ValidationSchema.params>;
  const { limit, offset, status } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  const job = getTrackedCronJob(cronJobKey);

  if (!job) {
    throw new ServerError('Cron job not found');
  }

  let whereClause = 'WHERE cron_job_key = $cronJobKey';
  const params: Record<string, unknown> = {
    cronJobKey,
    limit,
    offset,
  };

  if (status) {
    whereClause += ' AND status = $status';
    params.status = status;
  }

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
      cron_job_name: job.name,
    })),
    meta: {
      cron_job: {
        key: cronJobKey,
        name: job.name,
      },
      total: countRow?.count ?? 0,
      limit,
      offset,
    },
  });
}
