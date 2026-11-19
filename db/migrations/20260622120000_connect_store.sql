-- migrate:up

CREATE TABLE connect_store_devices (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_devices PRIMARY KEY,
  name varchar(255) NOT NULL,
  slug varchar(255) NOT NULL CONSTRAINT uk_connect_store_devices_slug UNIQUE,
  short_description text,
  description_md text,
  price_in_paisa integer NOT NULL,
  price_in_rupee numeric(12, 2) GENERATED ALWAYS AS (round(price_in_paisa / 100.0, 2)) STORED,
  image_id uuid CONSTRAINT fk_connect_store_devices_image_id REFERENCES files (id),
  stock_qty integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  created_by uuid,
  updated_by uuid
);

CREATE TABLE connect_store_carts (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_carts PRIMARY KEY,
  customer_id uuid CONSTRAINT fk_connect_store_carts_customer_id REFERENCES users (id),
  guest_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT uk_connect_store_carts_customer_id UNIQUE (customer_id),
  CONSTRAINT uk_connect_store_carts_guest_id UNIQUE (guest_id),
  CONSTRAINT chk_connect_store_carts_owner CHECK (
    (customer_id IS NOT NULL AND guest_id IS NULL)
    OR (customer_id IS NULL AND guest_id IS NOT NULL)
  )
);

CREATE TABLE connect_store_cart_items (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_cart_items PRIMARY KEY,
  cart_id uuid NOT NULL CONSTRAINT fk_connect_store_cart_items_cart_id REFERENCES connect_store_carts (id) ON DELETE CASCADE,
  device_id uuid NOT NULL CONSTRAINT fk_connect_store_cart_items_device_id REFERENCES connect_store_devices (id),
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT uk_connect_store_cart_items_cart_device UNIQUE (cart_id, device_id),
  CONSTRAINT chk_connect_store_cart_items_quantity CHECK (quantity > 0 AND quantity <= 100)
);

CREATE TYPE connect_store_address_type AS ENUM ('billing', 'shipping');

CREATE TABLE connect_store_addresses (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_addresses PRIMARY KEY,
  type connect_store_address_type NOT NULL,
  customer_id uuid NOT NULL CONSTRAINT fk_connect_store_addresses_customer_id REFERENCES users (id),
  address text NOT NULL,
  state_id uuid NOT NULL CONSTRAINT fk_connect_store_addresses_state_id REFERENCES states (id),
  city varchar(255) NOT NULL,
  postal_code varchar(10) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT uk_connect_store_addresses_customer_type UNIQUE (customer_id, type)
);

CREATE TYPE connect_store_payment_status AS ENUM ('pending', 'paid', 'failed');

CREATE TABLE connect_store_orders (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_orders PRIMARY KEY,
  customer_id uuid NOT NULL CONSTRAINT fk_connect_store_orders_customer_id REFERENCES users (id),
  payment_status connect_store_payment_status NOT NULL DEFAULT 'pending',
  status varchar(50) NOT NULL DEFAULT 'pending',
  total_amount_in_paisa integer NOT NULL,
  paid_amount_in_paisa integer NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  razorpay_order_id varchar(255),
  razorpay_payment_id varchar(255),
  razorpay_signature text,
  serial_number integer NOT NULL,
  billing_details jsonb NOT NULL DEFAULT '{}',
  billing_address jsonb NOT NULL,
  shipping_address jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  serial varchar(50) GENERATED ALWAYS AS (('SFPL-ORD-'::text || serial_number)) STORED
);

CREATE TABLE connect_store_order_items (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_order_items PRIMARY KEY,
  order_id uuid NOT NULL CONSTRAINT fk_connect_store_order_items_order_id REFERENCES connect_store_orders (id) ON DELETE CASCADE,
  device_id uuid NOT NULL CONSTRAINT fk_connect_store_order_items_device_id REFERENCES connect_store_devices (id),
  device_name varchar(255) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_in_paisa integer NOT NULL
);

CREATE INDEX idx_connect_store_devices_active_sort ON connect_store_devices (is_active, sort_order, created_at DESC);
CREATE INDEX idx_connect_store_orders_customer_id ON connect_store_orders (customer_id, created_at DESC);
CREATE INDEX idx_connect_store_orders_razorpay_order_id ON connect_store_orders (razorpay_order_id);

-- migrate:down

DROP TABLE IF EXISTS connect_store_order_items;
DROP TABLE IF EXISTS connect_store_orders;
DROP TYPE IF EXISTS connect_store_payment_status;
DROP TABLE IF EXISTS connect_store_addresses;
DROP TYPE IF EXISTS connect_store_address_type;
DROP TABLE IF EXISTS connect_store_cart_items;
DROP TABLE IF EXISTS connect_store_carts;
DROP TABLE IF EXISTS connect_store_devices;
