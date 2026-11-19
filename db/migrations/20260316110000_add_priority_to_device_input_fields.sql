-- migrate:up

ALTER TABLE device_input_fields
  ADD COLUMN priority integer NOT NULL DEFAULT 0;


-- migrate:down

ALTER TABLE device_input_fields
  DROP COLUMN IF EXISTS priority;
