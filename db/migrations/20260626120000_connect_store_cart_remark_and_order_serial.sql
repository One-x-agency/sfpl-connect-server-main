-- migrate:up

DELETE FROM connect_store_devices
WHERE slug IN ('connect-standard', 'connect-plus', 'connect-enterprise');

ALTER TABLE connect_store_carts
  ADD COLUMN remark text;

ALTER TABLE connect_store_orders DROP COLUMN serial;

ALTER TABLE connect_store_orders ALTER COLUMN serial_number DROP NOT NULL;

UPDATE connect_store_orders
SET serial_number = NULL
WHERE NOT is_paid;

ALTER TABLE connect_store_orders
ADD COLUMN serial varchar(50) GENERATED ALWAYS AS (
  CASE
    WHEN serial_number IS NOT NULL THEN 'SFPL-ORD-'::text || serial_number
    ELSE NULL
  END
) STORED;

CREATE SEQUENCE connect_store_order_serial_seq;

SELECT setval(
  'connect_store_order_serial_seq',
  COALESCE((SELECT MAX(serial_number) FROM connect_store_orders), 0) + 1,
  false
);

-- migrate:down

DROP SEQUENCE IF EXISTS connect_store_order_serial_seq;

ALTER TABLE connect_store_orders DROP COLUMN serial;

UPDATE connect_store_orders o
SET serial_number = sub.rn
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at)
    + COALESCE((SELECT MAX(serial_number) FROM connect_store_orders WHERE serial_number IS NOT NULL), 0) AS rn
  FROM connect_store_orders
  WHERE serial_number IS NULL
) sub
WHERE o.id = sub.id;

ALTER TABLE connect_store_orders ALTER COLUMN serial_number SET NOT NULL;

ALTER TABLE connect_store_orders
ADD COLUMN serial varchar(50) GENERATED ALWAYS AS (('SFPL-ORD-'::text || serial_number)) STORED;

ALTER TABLE connect_store_carts
  DROP COLUMN remark;
