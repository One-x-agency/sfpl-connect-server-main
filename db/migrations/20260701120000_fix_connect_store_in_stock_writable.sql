-- migrate:up
-- Replace generated in_stock (stock_qty > 0) with an admin-controlled boolean.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'connect_store_devices'
      AND column_name = 'in_stock'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE connect_store_devices DROP COLUMN in_stock;

    ALTER TABLE connect_store_devices
      ADD COLUMN in_stock boolean NOT NULL DEFAULT false;

    UPDATE connect_store_devices
    SET in_stock = stock_qty > 0;

    ALTER TABLE connect_store_devices
      DROP CONSTRAINT IF EXISTS chk_connect_store_devices_stock_qty;

    ALTER TABLE connect_store_devices
      DROP COLUMN stock_qty;
  END IF;
END $$;

-- migrate:down

ALTER TABLE connect_store_devices DROP COLUMN IF EXISTS in_stock;

ALTER TABLE connect_store_devices
  ADD COLUMN IF NOT EXISTS stock_qty integer NOT NULL DEFAULT 0;

ALTER TABLE connect_store_devices
  ADD COLUMN in_stock boolean GENERATED ALWAYS AS (stock_qty > 0) STORED;

ALTER TABLE connect_store_devices
  ADD CONSTRAINT chk_connect_store_devices_stock_qty
  CHECK (stock_qty >= 0 AND stock_qty <= 100000);
