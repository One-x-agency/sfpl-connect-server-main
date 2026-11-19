import type { NextFunction, Request, Response } from 'express';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { getTrackedCronJobs } from '@/core/cron/createCronJob.js';
import { getCronJobRunStats } from '@/core/cron/cronMonitor.service.js';

export const ValidationSchema = {};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const trackedJobs = [...getTrackedCronJobs().values()];
  const keys = trackedJobs.map((job) => job.key);
  const statsByKey = await getCronJobRunStats(keys);

  const data = trackedJobs
    .sort((a, b) => {
      const moduleCompare = (a.module ?? '').localeCompare(b.module ?? '');
      if (moduleCompare !== 0) return moduleCompare;
      return a.name.localeCompare(b.name);
    })
    .map((job) => {
      const stats = statsByKey.get(job.key);
      const liveStatus = job.job.getStatus();

      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        timezone: job.timezone,
        description: job.description ?? null,
        module: job.module ?? null,
        is_enabled: job.isEnabled,
        live_status: liveStatus ?? (job.isEnabled ? 'unknown' : 'disabled'),
        last_run_at: job.lastRunAt?.toISOString() ?? null,
        last_run_status: job.lastRunStatus,
        last_run_duration_ms: job.lastRunDurationMs,
        next_run_at: job.job.getNextRun()?.toISOString() ?? null,
        total_runs: stats?.total_runs ?? 0,
        success_runs: stats?.success_runs ?? 0,
        failed_runs: stats?.failed_runs ?? 0,
        avg_duration_ms: stats?.avg_duration_ms ?? null,
        registered_at: job.registeredAt.toISOString(),
      };
    });

  return res.status(StatusCodes.OK).json({ data });
}
