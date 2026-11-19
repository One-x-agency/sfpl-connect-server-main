import Logger from '@/service/logger/index.js';
import { logCronRunFinish, logCronRunStart } from '@/core/cron/cronMonitor.service.js';

type CronTaskFn = () => Promise<void>;

export function withCronTask(key: string, fn: CronTaskFn): CronTaskFn {
  return async () => {
    const startedAt = Date.now();
    const runId = await logCronRunStart(key);

    try {
      await fn();
      await logCronRunFinish(runId, key, 'success', Date.now() - startedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error(`Cron "${key}" failed: ${message}`, error);
      await logCronRunFinish(runId, key, 'failed', Date.now() - startedAt, message);
      throw error;
    }
  };
}
