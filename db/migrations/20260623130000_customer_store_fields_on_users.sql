-- migrate:up

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_name varchar(255),
  ADD COLUMN IF NOT EXISTS gst_number varchar(15),
  ADD COLUMN IF NOT EXISTS pan_number varchar(10);

UPDATE users u
SET
  organization_name = COALESCE(NULLIF(a.organization_name, ''), u.organization_name),
  gst_number = COALESCE(NULLIF(a.gst_number, ''), u.gst_number),
  pan_number = COALESCE(NULLIF(a.pan_number, ''), u.pan_number)
FROM connect_store_account_details a
WHERE a.customer_id = u.id;

DROP TABLE IF EXISTS connect_store_account_details;

-- migrate:down

CREATE TABLE connect_store_account_details (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_connect_store_account_details PRIMARY KEY,
  customer_id uuid NOT NULL CONSTRAINT fk_connect_store_account_details_customer_id REFERENCES users (id),
  full_name varchar(255) NOT NULL,
  phone_number varchar(15) NOT NULL,
  organization_name varchar(255),
  gst_number varchar(15),
  pan_number varchar(10),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT uk_connect_store_account_details_customer_id UNIQUE (customer_id)
);

INSERT INTO connect_store_account_details (
  customer_id,
  full_name,
  phone_number,
  organization_name,
  gst_number,
  pan_number
)
SELECT
  u.id,
  u.name,
  COALESCE(u.phone_number, ''),
  u.organization_name,
  u.gst_number,
  u.pan_number
FROM users u
WHERE u.role = 'customer';

ALTER TABLE users
  DROP COLUMN IF EXISTS organization_name,
  DROP COLUMN IF EXISTS gst_number,
  DROP COLUMN IF EXISTS pan_number;
