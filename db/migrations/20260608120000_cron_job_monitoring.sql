-- migrate:up

drop table if exists cron_job_runs;
drop table if exists cron_jobs;

CREATE TABLE cron_job_runs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  cron_job_key varchar(100) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms int,
  status varchar(20) NOT NULL DEFAULT 'running',
  error_message text,
  trigger_reason varchar(20) NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cron_job_runs_key_started ON cron_job_runs (cron_job_key, started_at DESC);

-- migrate:down

DROP TABLE IF EXISTS cron_job_runs;
