-- migrate:up

CREATE TABLE device_log_archives (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  imei varchar(15) NOT NULL,
  year_month char(7) NOT NULL,
  s3_bucket varchar(255) NOT NULL,
  s3_key text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_device_log_archives_device_month UNIQUE (device_id, year_month),
  CONSTRAINT chk_device_log_archives_year_month CHECK (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

CREATE INDEX idx_device_log_archives_device_id ON device_log_archives (device_id, year_month DESC);

-- migrate:down

DROP TABLE IF EXISTS device_log_archives;
  