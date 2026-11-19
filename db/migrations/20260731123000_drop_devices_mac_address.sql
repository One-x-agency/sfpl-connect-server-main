-- migrate:up

ALTER TABLE devices
  DROP COLUMN IF EXISTS mac_address;

-- migrate:down

ALTER TABLE devices
  ADD COLUMN mac_address character varying(32);
