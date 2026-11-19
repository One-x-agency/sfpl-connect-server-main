-- migrate:up

ALTER TABLE connect_store_orders
  ADD COLUMN docket_number character varying(100),
  ADD COLUMN delivery_partner character varying(100),
  ADD COLUMN status_details jsonb NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down

ALTER TABLE connect_store_orders
  DROP COLUMN IF EXISTS status_details,
  DROP COLUMN IF EXISTS delivery_partner,
  DROP COLUMN IF EXISTS docket_number;
