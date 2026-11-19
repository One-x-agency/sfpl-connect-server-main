-- migrate:up

-- invoices
-- Serial format: SFPL-INV-{YY}{MM}{XXXX} (Asia/Kolkata)
-- Example: SFPL-INV-26070015
-- Monthly series (last 4 digits) increases by a random 1–10 per invoice.
-- Intra-state charges: equal CGST/SGST; odd leftover paisa absorbed into taxable.

DROP SEQUENCE IF EXISTS connect_store_invoice_serial_seq;
DROP TABLE IF EXISTS connect_store_invoices CASCADE;
DROP TABLE IF EXISTS invoice CASCADE;

CREATE TABLE invoices (
  id uuid DEFAULT uuidv7() NOT NULL,
  order_id uuid NOT NULL,
  order_number varchar(50) NOT NULL,
  serial_number integer NOT NULL,
  serial varchar(50) GENERATED ALWAYS AS (('SFPL-INV-'::text || serial_number)) STORED,
  issued_at timestamptz DEFAULT now() NOT NULL,
  status varchar(50) DEFAULT 'issued' NOT NULL,
  billing_details jsonb NOT NULL,
  billing_address jsonb NOT NULL,
  shipping_address jsonb NOT NULL,
  place_of_supply_state_name varchar(255) NOT NULL,
  place_of_supply_gst_code varchar(2) NOT NULL,
  is_inter_state boolean NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  charges jsonb DEFAULT '[]'::jsonb NOT NULL,
  taxable_amount_in_paisa integer NOT NULL,
  tax_amount_in_paisa integer NOT NULL,
  total_amount_in_paisa integer NOT NULL,
  seller_gstin varchar(20) NOT NULL,
  seller_state_gst_code varchar(2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz,
  CONSTRAINT pk_invoices PRIMARY KEY (id),
  CONSTRAINT uq_invoices_order_id UNIQUE (order_id),
  CONSTRAINT uq_invoices_serial_number UNIQUE (serial_number),
  CONSTRAINT fk_invoices_order_id
    FOREIGN KEY (order_id) REFERENCES connect_store_orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_invoices_order_number
  ON invoices (order_number);

CREATE INDEX idx_invoices_serial
  ON invoices (serial);

-- Backfill invoices for orders already in shipping / delivered / complete
DO $$
DECLARE
  seller_gstin constant text := '24ABMCS2003B1ZZ';
  seller_state_code constant text := '24';
  gst_factor constant numeric := 1.18;
  r record;
  buyer_gst_code text;
  place_state_name text;
  place_gst_code text;
  is_inter boolean;
  taxable integer;
  tax_amount integer;
  cgst_amount integer;
  sgst_amount integer;
  charges jsonb;
  items jsonb;
  line_taxable_sum integer;
  last_idx integer;
  last_item jsonb;
  delta integer;
  yymm integer;
  series integer := 0;
  prev_yymm integer := NULL;
  step integer;
  serial_number integer;
BEGIN
  FOR r IN
    SELECT
      o.id,
      o.serial,
      o.total_amount_in_paisa,
      o.billing_details,
      o.billing_address,
      o.shipping_address,
      COALESCE(o.updated_at, o.created_at) AS issued_at
    FROM connect_store_orders o
    WHERE o.is_paid = true
      AND o.serial IS NOT NULL
      AND o.status IN ('out_for_delivery', 'delivered', 'complete')
      AND EXISTS (
        SELECT 1 FROM connect_store_order_items oi WHERE oi.order_id = o.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM invoices i WHERE i.order_id = o.id
      )
    ORDER BY COALESCE(o.updated_at, o.created_at) ASC, o.created_at ASC, o.id ASC
  LOOP
    buyer_gst_code := NULLIF(TRIM(BOTH FROM COALESCE(r.shipping_address->>'state_gst_code', '')), '');
    place_state_name := NULLIF(TRIM(BOTH FROM COALESCE(r.shipping_address->>'state_name', '')), '');
    IF place_state_name IS NULL THEN
      place_state_name := 'Unknown';
    END IF;
    place_gst_code := LEFT(COALESCE(buyer_gst_code, '00'), 2);

    -- Place of supply for goods = shipping state (not billing)
    is_inter := COALESCE(buyer_gst_code, '') <> seller_state_code;
    taxable := ROUND(r.total_amount_in_paisa::numeric / gst_factor)::integer;
    tax_amount := r.total_amount_in_paisa - taxable;

    IF is_inter THEN
      charges := jsonb_build_array(
        jsonb_build_object(
          'type', 'IGST',
          'rate', 18,
          'amount_in_paisa', tax_amount
        )
      );
    ELSE
      -- Equal CGST/SGST; odd leftover paisa absorbed into taxable
      cgst_amount := FLOOR(tax_amount::numeric / 2)::integer;
      sgst_amount := cgst_amount;
      taxable := taxable + (tax_amount - cgst_amount - sgst_amount);
      tax_amount := cgst_amount + sgst_amount;
      charges := jsonb_build_array(
        jsonb_build_object(
          'type', 'CGST',
          'rate', 9,
          'amount_in_paisa', cgst_amount
        ),
        jsonb_build_object(
          'type', 'SGST',
          'rate', 9,
          'amount_in_paisa', sgst_amount
        )
      );
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'plan_id', oi.device_id,
          'plan_name', oi.device_name,
          'hsn_sac', oi.hsn_sac,
          'quantity', oi.quantity,
          'price_in_paisa', oi.price_in_paisa,
          'taxable_amount_in_paisa', ROUND((oi.price_in_paisa * oi.quantity)::numeric / gst_factor)::integer,
          'tax_amount_in_paisa',
            (oi.price_in_paisa * oi.quantity)
            - ROUND((oi.price_in_paisa * oi.quantity)::numeric / gst_factor)::integer,
          'total_amount_in_paisa', oi.price_in_paisa * oi.quantity
        )
        ORDER BY oi.id
      ),
      '[]'::jsonb
    )
    INTO items
    FROM connect_store_order_items oi
    WHERE oi.order_id = r.id;

    SELECT COALESCE(SUM((elem->>'taxable_amount_in_paisa')::integer), 0)
    INTO line_taxable_sum
    FROM jsonb_array_elements(items) AS elem;

    IF jsonb_array_length(items) > 0 AND line_taxable_sum <> taxable THEN
      delta := taxable - line_taxable_sum;
      last_idx := jsonb_array_length(items) - 1;
      last_item := items->last_idx;
      last_item := jsonb_set(
        last_item,
        '{taxable_amount_in_paisa}',
        to_jsonb((last_item->>'taxable_amount_in_paisa')::integer + delta)
      );
      last_item := jsonb_set(
        last_item,
        '{tax_amount_in_paisa}',
        to_jsonb(
          (last_item->>'total_amount_in_paisa')::integer
          - (last_item->>'taxable_amount_in_paisa')::integer
        )
      );
      items := jsonb_set(items, ARRAY[last_idx::text], last_item);
    END IF;

    yymm := to_char(r.issued_at AT TIME ZONE 'Asia/Kolkata', 'YYMM')::integer;
    IF prev_yymm IS DISTINCT FROM yymm THEN
      series := 0;
      prev_yymm := yymm;
    END IF;

    step := 1 + floor(random() * 10)::integer; -- 1..10
    series := series + step;
    IF series > 9999 THEN
      RAISE EXCEPTION 'Invoice serial series exhausted for YYMM %', yymm;
    END IF;
    serial_number := (yymm * 10000) + series;

    INSERT INTO invoices (
      order_id,
      order_number,
      serial_number,
      issued_at,
      billing_details,
      billing_address,
      shipping_address,
      place_of_supply_state_name,
      place_of_supply_gst_code,
      is_inter_state,
      items,
      charges,
      taxable_amount_in_paisa,
      tax_amount_in_paisa,
      total_amount_in_paisa,
      seller_gstin,
      seller_state_gst_code
    ) VALUES (
      r.id,
      r.serial,
      serial_number,
      r.issued_at,
      COALESCE(r.billing_details, '{}'::jsonb),
      COALESCE(r.billing_address, '{}'::jsonb),
      COALESCE(r.shipping_address, '{}'::jsonb),
      place_state_name,
      place_gst_code,
      is_inter,
      items,
      charges,
      taxable,
      tax_amount,
      r.total_amount_in_paisa,
      seller_gstin,
      seller_state_code
    )
    ON CONFLICT (order_id) DO NOTHING;
  END LOOP;
END $$;

-- migrate:down

DROP TABLE IF EXISTS invoices;
