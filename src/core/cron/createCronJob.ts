import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import env from '@/config/env.js';
import Logger from '@/service/logger/index.js';
import type { CronRunStatus } from '@/core/cron/cronMonitor.service.js';

type CronTaskFn = () => Promise<void>;

export interface CreateCronJobOptions {
  key: string;
  name: string;
  schedule: string;
  timezone?: string;
  description?: string;
  module?: string;
  task: CronTaskFn;
  /** Absolute path — node-cron runs this in a separate process in production. */
  scriptPath?: string;
  enabled?: boolean | (() => boolean);
  autoStart?: boolean;
}

export type CronJobHandle = ScheduledTask & {
  key: string;
  isEnabled: boolean;
};

export interface TrackedCronJob {
  job: CronJobHandle;
  key: string;
  name: string;
  schedule: string;
  timezone: string;
  description?: string;
  module?: string;
  isEnabled: boolean;
  lastRunAt: Date | null;
  lastRunStatus: CronRunStatus | null;
  lastRunDurationMs: number | null;
  registeredAt: Date;
}

const trackedJobs = new Map<string, TrackedCronJob>();

export function getTrackedCronJobs(): Map<string, TrackedCronJob> {
  return trackedJobs;
}

export function getTrackedCronJob(key: string): TrackedCronJob | undefined {
  return trackedJobs.get(key);
}

export function updateTrackedJobRunSummary(
  key: string,
  input: {
    status: CronRunStatus;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number | null;
  },
): void {
  const tracked = trackedJobs.get(key);
  if (!tracked) return;

  tracked.lastRunAt = input.startedAt ?? input.finishedAt ?? tracked.lastRunAt;
  tracked.lastRunStatus = input.status;

  if (input.durationMs != null) {
    tracked.lastRunDurationMs = input.durationMs;
  }
}

export function createCronJob(options: CreateCronJobOptions): CronJobHandle {
  const {
    key,
    name,
    schedule,
    task,
    scriptPath,
    description,
    module,
    timezone = 'Asia/Kolkata',
    enabled = true,
    autoStart = false,
  } = options;

  const isEnabled = typeof enabled === 'function' ? enabled() : enabled;
  const runner = env.env === 'production' && scriptPath ? scriptPath : task;
  const scheduled = cron.createTask(schedule, runner, { timezone, name: key });
  const baseStart = scheduled.start.bind(scheduled);

  const job = Object.assign(scheduled, {
    key,
    isEnabled,
    async start() {
      if (!isEnabled) {
        Logger.warn(`Cron job "${key}" is disabled — start() skipped`);
        return;
      }
      try {
        await baseStart();
        Logger.info(`Cron job started: ${name} (${schedule}, ${timezone})`);
      } catch (error) {
        Logger.error(`Cron job "${key}" failed to start`, error);
      }
    },
  }) as CronJobHandle;

  trackedJobs.set(key, {
    job,
    key,
    name,
    schedule,
    timezone,
    description,
    module,
    isEnabled,
    lastRunAt: null,
    lastRunStatus: null,
    lastRunDurationMs: null,
    registeredAt: new Date(),
  });

  if (!isEnabled) {
    Logger.info(`Cron job registered but disabled: ${name}`);
  } else if (autoStart) {
    void job.start();
  }

  return job;
}
