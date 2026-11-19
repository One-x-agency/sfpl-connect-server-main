-- migrate:up

ALTER TABLE connect_store_devices
  ADD COLUMN hsn_sac varchar(8);

ALTER TABLE connect_store_order_items
  ADD COLUMN hsn_sac varchar(8);

-- migrate:down

ALTER TABLE connect_store_order_items
  DROP COLUMN IF EXISTS hsn_sac;

ALTER TABLE connect_store_devices
  DROP COLUMN IF EXISTS hsn_sac;
