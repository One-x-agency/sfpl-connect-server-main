-- migrate:up

ALTER TABLE connect_store_devices
  ADD COLUMN in_stock boolean NOT NULL DEFAULT false;

UPDATE connect_store_devices
SET in_stock = stock_qty > 0;

ALTER TABLE connect_store_devices
  DROP COLUMN stock_qty;

-- migrate:down

ALTER TABLE connect_store_devices
  ADD COLUMN stock_qty integer NOT NULL DEFAULT 0;

UPDATE connect_store_devices
SET stock_qty = CASE WHEN in_stock THEN 1 ELSE 0 END;

ALTER TABLE connect_store_devices
  DROP COLUMN in_stock;
