import Database from '@/service/database/index.js';
import Logger from '@/service/logger/index.js';
import { updateTrackedJobRunSummary } from '@/core/cron/createCronJob.js';

export type CronRunStatus = 'running' | 'success' | 'failed';

export async function logCronRunStart(key: string): Promise<string | null> {
  const startedAt = new Date();
  updateTrackedJobRunSummary(key, { status: 'running', startedAt });

  try {
    const row = await Database.namedQueryOne<{ id: string }>(
      `
        INSERT INTO cron_job_runs (cron_job_key, status, started_at)
        VALUES ($key, 'running', $startedAt)
        RETURNING id
      `,
      { key, startedAt },
    );
    return row?.id ?? null;
  } catch (error) {
    Logger.error(`Cron "${key}": failed to log run start`, error);
    return null;
  }
}

export async function logCronRunFinish(
  runId: string | null,
  key: string,
  status: 'success' | 'failed',
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  updateTrackedJobRunSummary(key, {
    status,
    durationMs,
    finishedAt: new Date(),
  });

  if (!runId) return;

  try {
    await Database.namedQueryAll(
      `
        UPDATE cron_job_runs
        SET finished_at = NOW(), duration_ms = $durationMs, status = $status, error_message = $errorMessage
        WHERE id = $runId
      `,
      { runId, durationMs, status, errorMessage: errorMessage ?? null },
    );
  } catch (error) {
    Logger.error(`Cron "${key}": failed to log run finish`, error);
  }
}

export interface CronJobRunStats {
  cron_job_key: string;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  avg_duration_ms: number | null;
}

export async function getCronJobRunStats(keys: string[]): Promise<Map<string, CronJobRunStats>> {
  if (!keys.length) return new Map();

  try {
    const rows = await Database.namedQueryAll<CronJobRunStats>(
      `
        SELECT
          cron_job_key,
          COUNT(*)::int AS total_runs,
          COUNT(*) FILTER (WHERE status = 'success')::int AS success_runs,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_runs,
          ROUND(AVG(duration_ms) FILTER (WHERE status = 'success'))::int AS avg_duration_ms
        FROM cron_job_runs
        WHERE cron_job_key = ANY($keys)
        GROUP BY cron_job_key
      `,
      { keys },
    );

    return new Map(rows.map((row) => [row.cron_job_key, row]));
  } catch (error) {
    Logger.error('Cron monitor: failed to load run stats', error);
    return new Map();
  }
}
