-- migrate:up

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

-- migrate:down

DROP TABLE IF EXISTS connect_store_account_details;
