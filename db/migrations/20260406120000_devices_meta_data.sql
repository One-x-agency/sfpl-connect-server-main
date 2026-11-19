-- migrate:up

ALTER TABLE devices
  ADD COLUMN meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down

ALTER TABLE devices
  DROP COLUMN IF EXISTS meta_data;
