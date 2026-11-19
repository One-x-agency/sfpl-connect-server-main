-- migrate:up

-- Pin activity labels should include the affected device IMEI
-- (device_input_fields row only has device_id, not imei).

CREATE OR REPLACE FUNCTION activity_get_entity_label(p_module text, p_row jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  pin_label text;
  device_imei text;
BEGIN
  IF p_module = 'device_input_fields' THEN
    pin_label := COALESCE(
      NULLIF(TRIM(BOTH FROM CONCAT(p_row->>'io_pin', ' - ', p_row->>'name')), ''),
      NULLIF(TRIM(BOTH FROM p_row->>'name'), ''),
      NULLIF(TRIM(BOTH FROM p_row->>'io_pin'), ''),
      p_row->>'id'
    );

    IF p_row->>'device_id' IS NOT NULL AND p_row->>'device_id' <> '' THEN
      SELECT d.imei
      INTO device_imei
      FROM devices d
      WHERE d.id = (p_row->>'device_id')::uuid;
    END IF;

    IF device_imei IS NOT NULL AND device_imei <> '' THEN
      RETURN pin_label || ' · IMEI ' || device_imei;
    END IF;

    RETURN pin_label;
  END IF;

  RETURN CASE p_module
    WHEN 'users' THEN COALESCE(p_row->>'name', p_row->>'email', p_row->>'id')
    WHEN 'devices' THEN COALESCE(p_row->>'name', p_row->>'imei', p_row->>'id')
    WHEN 'sim_plans' THEN COALESCE(p_row->>'name', p_row->>'id')
    WHEN 'sim_cards' THEN COALESCE(p_row->>'number', p_row->>'id')
    WHEN 'connect_store_devices' THEN COALESCE(p_row->>'name', p_row->>'slug', p_row->>'id')
    WHEN 'connect_store_orders' THEN COALESCE(p_row->>'serial', p_row->>'id')
    ELSE p_row->>'id'
  END;
END;
$$;

-- migrate:down

CREATE OR REPLACE FUNCTION activity_get_entity_label(p_module text, p_row jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_module
    WHEN 'users' THEN COALESCE(p_row->>'name', p_row->>'email', p_row->>'id')
    WHEN 'devices' THEN COALESCE(p_row->>'name', p_row->>'imei', p_row->>'id')
    WHEN 'device_input_fields' THEN COALESCE(
      NULLIF(TRIM(BOTH FROM CONCAT(p_row->>'io_pin', ' - ', p_row->>'name')), ''),
      p_row->>'name',
      p_row->>'io_pin',
      p_row->>'id'
    )
    WHEN 'sim_plans' THEN COALESCE(p_row->>'name', p_row->>'id')
    WHEN 'sim_cards' THEN COALESCE(p_row->>'number', p_row->>'id')
    WHEN 'connect_store_devices' THEN COALESCE(p_row->>'name', p_row->>'slug', p_row->>'id')
    WHEN 'connect_store_orders' THEN COALESCE(p_row->>'serial', p_row->>'id')
    ELSE p_row->>'id'
  END;
$$;
