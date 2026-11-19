-- migrate:up

-- Order status history
CREATE TABLE connect_store_order_status_history (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_order_status_history PRIMARY KEY,
  order_id uuid NOT NULL
    CONSTRAINT fk_connect_store_order_status_history_order
    REFERENCES connect_store_orders(id) ON DELETE CASCADE,
  to_status character varying(50) NOT NULL,
  staff_id uuid
    CONSTRAINT fk_connect_store_order_status_history_staff
    REFERENCES users(id) ON DELETE SET NULL,
  staff_name character varying(255) NOT NULL,
  "timestamp" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_connect_store_order_status_history_order_timestamp
  ON connect_store_order_status_history (order_id, "timestamp");

-- Connect plan: devices per unit
ALTER TABLE connect_store_devices
  ADD COLUMN connect_count integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT chk_connect_store_devices_connect_count
    CHECK (connect_count > 0);

-- Physical devices: order link, serial, batch
CREATE SEQUENCE device_serial_seq START WITH 1200;

ALTER TABLE devices
  ADD COLUMN order_id uuid
    CONSTRAINT fk_devices_order_id
    REFERENCES connect_store_orders(id) ON DELETE SET NULL,
  ADD COLUMN serial_number integer NOT NULL DEFAULT nextval('device_serial_seq'),
  ADD COLUMN serial character varying(50) GENERATED ALWAYS AS (
    ('SFPL-CONNECT-'::text || lpad(serial_number::text, 5, '0'))
  ) STORED,
  ADD COLUMN batch_number character varying(100);

ALTER TABLE devices
  ADD CONSTRAINT uq_devices_serial_number UNIQUE (serial_number);

CREATE INDEX idx_devices_order_id ON devices (order_id);
CREATE INDEX idx_devices_unassigned ON devices (created_at DESC) WHERE user_id IS NULL;

-- migrate:down

DROP INDEX IF EXISTS idx_devices_unassigned;
DROP INDEX IF EXISTS idx_devices_order_id;

ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS uq_devices_serial_number,
  DROP CONSTRAINT IF EXISTS fk_devices_order_id,
  DROP COLUMN IF EXISTS batch_number,
  DROP COLUMN IF EXISTS serial,
  DROP COLUMN IF EXISTS serial_number,
  DROP COLUMN IF EXISTS order_id;

DROP SEQUENCE IF EXISTS device_serial_seq;

ALTER TABLE connect_store_devices
  DROP CONSTRAINT IF EXISTS chk_connect_store_devices_connect_count,
  DROP COLUMN IF EXISTS connect_count;

DROP TABLE IF EXISTS connect_store_order_status_history;
