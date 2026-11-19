-- migrate:up

ALTER TABLE devices
  ADD COLUMN firmware_version varchar(100) not null default '1.0.0';

-- migrate:down

ALTER TABLE devices
  DROP COLUMN IF EXISTS firmware_version;
