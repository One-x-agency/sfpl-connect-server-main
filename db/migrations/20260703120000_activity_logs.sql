-- migrate:up

CREATE TYPE activity_action AS ENUM (
  'create',
  'update',
  'delete',
  'status_change',
  'activate',
  'deactivate',
  'otp_sent',
  'otp_verified',
  'login',
  'set_configuration',
  'set_calibration'
);

CREATE TABLE activity_logs (
  id uuid DEFAULT uuidv7() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  module varchar(100) NOT NULL,
  action activity_action NOT NULL,
  entity_id uuid NOT NULL,
  entity_label varchar(255),
  changes jsonb,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  ip_address varchar(45),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON activity_logs (user_id);
CREATE INDEX idx_activity_logs_module ON activity_logs (module);
CREATE INDEX idx_activity_logs_action ON activity_logs (action);
CREATE INDEX idx_activity_logs_entity_id ON activity_logs (entity_id);

CREATE OR REPLACE FUNCTION activity_get_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION activity_get_ip_address()
RETURNS varchar
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.ip_address', true), '');
$$;

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

CREATE OR REPLACE FUNCTION activity_jsonb_diff(
  old_row jsonb,
  new_row jsonb,
  ignore_keys text[] DEFAULT ARRAY['updated_at']
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  k text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(new_row)
  LOOP
    IF k = ANY(ignore_keys) THEN
      CONTINUE;
    END IF;

    IF old_row->k IS DISTINCT FROM new_row->k THEN
      result := result || jsonb_build_object(
        k,
        jsonb_build_object('old', old_row->k, 'new', new_row->k)
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION activity_diff_ignore_keys(p_module text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_module
    WHEN 'connect_store_orders' THEN ARRAY['updated_at', 'status_details']
    ELSE ARRAY['updated_at']
  END;
$$;

CREATE OR REPLACE FUNCTION activity_resolve_ref_label(p_field text, p_value jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_id uuid;
  v_label text;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb OR jsonb_typeof(p_value) <> 'string' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_id := (p_value #>> '{}')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF p_field IN ('user_id', 'customer_id', 'created_by', 'updated_by', 'actor_id') THEN
    SELECT COALESCE(NULLIF(TRIM(name), ''), email)
    INTO v_label
    FROM users
    WHERE id = v_id;
  ELSIF p_field = 'project_id' THEN
    SELECT name INTO v_label FROM projects WHERE id = v_id;
  ELSIF p_field = 'device_id' THEN
    SELECT COALESCE(NULLIF(TRIM(name), ''), imei)
    INTO v_label
    FROM devices
    WHERE id = v_id;
  ELSIF p_field IN ('image_id', 'file_id') THEN
    SELECT key INTO v_label FROM files WHERE id = v_id;
  ELSIF p_field = 'sim_plan_id' THEN
    SELECT name INTO v_label FROM sim_plans WHERE id = v_id;
  ELSIF p_field = 'sim_card_id' THEN
    SELECT number INTO v_label FROM sim_cards WHERE id = v_id;
  ELSIF p_field = 'order_id' THEN
    SELECT serial INTO v_label FROM connect_store_orders WHERE id = v_id;
  END IF;

  RETURN NULLIF(TRIM(v_label), '');
END;
$$;

CREATE OR REPLACE FUNCTION activity_enrich_changes(p_changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  k text;
  entry jsonb;
  old_label text;
  new_label text;
  result jsonb := '{}'::jsonb;
BEGIN
  IF p_changes IS NULL OR p_changes = '{}'::jsonb THEN
    RETURN p_changes;
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_changes)
  LOOP
    entry := p_changes->k;

    IF entry ? 'old_label' OR entry ? 'new_label' THEN
      result := result || jsonb_build_object(k, entry);
      CONTINUE;
    END IF;

    old_label := activity_resolve_ref_label(k, entry->'old');
    new_label := activity_resolve_ref_label(k, entry->'new');

    IF old_label IS NOT NULL THEN
      entry := entry || jsonb_build_object('old_label', old_label);
    END IF;

    IF new_label IS NOT NULL THEN
      entry := entry || jsonb_build_object('new_label', new_label);
    END IF;

    result := result || jsonb_build_object(k, entry);
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION activity_resolve_action(
  p_module text,
  p_changes jsonb,
  p_new_row jsonb
)
RETURNS activity_action
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_changes ? 'is_deleted' AND (p_new_row->>'is_deleted')::boolean IS TRUE THEN
    RETURN 'delete';
  END IF;

  IF p_changes ? 'is_active' THEN
    IF (p_new_row->>'is_active')::boolean IS TRUE THEN
      RETURN 'activate';
    END IF;
    RETURN 'deactivate';
  END IF;

  IF p_changes ? 'status' OR p_changes ? 'payment_status' THEN
    RETURN 'status_change';
  END IF;

  RETURN 'update';
END;
$$;

CREATE OR REPLACE FUNCTION activity_is_dashboard_preference_update(
  p_module text,
  p_old_row jsonb,
  p_new_row jsonb,
  p_changes jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
BEGIN
  IF p_module <> 'users' OR NOT (p_changes ? 'metadata') THEN
    RETURN false;
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_changes)
  LOOP
    IF k <> 'metadata' THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN COALESCE(p_old_row->'metadata', '{}'::jsonb) - 'dashboard'
    IS NOT DISTINCT FROM
    COALESCE(p_new_row->'metadata', '{}'::jsonb) - 'dashboard';
END;
$$;

CREATE OR REPLACE FUNCTION activity_is_staff_actor(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = p_user_id
        AND u.role = ANY(ARRAY[
          'admin'::user_role,
          'qc'::user_role,
          'support'::user_role,
          'accountant'::user_role,
          'warehouse'::user_role
        ])
        AND u.is_deleted = false
        AND u.is_active = true
    )
  END;
$$;

CREATE OR REPLACE FUNCTION insert_activity_log(
  p_user_id uuid,
  p_module text,
  p_action activity_action,
  p_entity_id uuid,
  p_entity_label text DEFAULT NULL,
  p_changes jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_ip_address varchar DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
AS $$
  INSERT INTO activity_logs (
    user_id,
    module,
    action,
    entity_id,
    entity_label,
    changes,
    metadata,
    ip_address
  )
  VALUES (
    p_user_id,
    p_module,
    p_action,
    p_entity_id,
    p_entity_label,
    p_changes,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_address
  )
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION activity_audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_module text := TG_TABLE_NAME;
  v_actor_id uuid := activity_get_actor_id();
  v_ip_address varchar := activity_get_ip_address();
  v_old_row jsonb;
  v_new_row jsonb;
  v_changes jsonb;
  v_action activity_action;
  v_entity_label text;
  v_entity_id uuid;
BEGIN
  IF NOT activity_is_staff_actor(v_actor_id) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new_row := to_jsonb(NEW);
    v_entity_id := NEW.id;
    v_entity_label := activity_get_entity_label(v_module, v_new_row);

    INSERT INTO activity_logs (
      user_id, module, action, entity_id, entity_label, metadata, ip_address
    )
    VALUES (
      v_actor_id,
      v_module,
      'create',
      v_entity_id,
      v_entity_label,
      '{}'::jsonb,
      v_ip_address
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old_row := to_jsonb(OLD);
    v_entity_id := OLD.id;
    v_entity_label := activity_get_entity_label(v_module, v_old_row);

    INSERT INTO activity_logs (
      user_id, module, action, entity_id, entity_label, metadata, ip_address
    )
    VALUES (
      v_actor_id,
      v_module,
      'delete',
      v_entity_id,
      v_entity_label,
      '{}'::jsonb,
      v_ip_address
    );

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_row := to_jsonb(OLD);
    v_new_row := to_jsonb(NEW);
    v_changes := activity_jsonb_diff(v_old_row, v_new_row, activity_diff_ignore_keys(v_module));

    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    IF activity_is_dashboard_preference_update(v_module, v_old_row, v_new_row, v_changes) THEN
      RETURN NEW;
    END IF;

    v_action := activity_resolve_action(v_module, v_changes, v_new_row);
    v_entity_id := NEW.id;
    v_entity_label := activity_get_entity_label(v_module, v_new_row);
    v_changes := activity_enrich_changes(v_changes);

    INSERT INTO activity_logs (
      user_id, module, action, entity_id, entity_label, changes, metadata, ip_address
    )
    VALUES (
      v_actor_id,
      v_module,
      v_action,
      v_entity_id,
      v_entity_label,
      v_changes,
      '{}'::jsonb,
      v_ip_address
    );

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_activity_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION activity_audit_trigger_fn();

CREATE TRIGGER trg_activity_devices
  AFTER INSERT OR UPDATE OR DELETE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION activity_audit_trigger_fn();

CREATE TRIGGER trg_activity_device_input_fields
  AFTER INSERT OR UPDATE OR DELETE ON device_input_fields
  FOR EACH ROW
  EXECUTE FUNCTION activity_audit_trigger_fn();

CREATE TRIGGER trg_activity_sim_plans
  AFTER INSERT OR UPDATE OR DELETE ON sim_plans
  FOR EACH ROW
  EXECUTE FUNCTION activity_audit_trigger_fn();

CREATE TRIGGER trg_activity_sim_cards
  AFTER INSERT OR UPDATE OR DELETE ON sim_cards
  FOR EACH ROW
  EXECUTE FUNCTION activity_audit_trigger_fn();

CREATE TRIGGER trg_activity_connect_store_devices
  AFTER INSERT OR UPDATE OR DELETE ON connect_store_devices
  FOR EACH ROW
  EXECUTE FUNCTION activity_audit_trigger_fn();

CREATE TRIGGER trg_activity_connect_store_orders
  AFTER INSERT OR UPDATE OR DELETE ON connect_store_orders
  FOR EACH ROW
  EXECUTE FUNCTION activity_audit_trigger_fn();

-- migrate:down

DROP TRIGGER IF EXISTS trg_activity_connect_store_orders ON connect_store_orders;
DROP TRIGGER IF EXISTS trg_activity_connect_store_devices ON connect_store_devices;
DROP TRIGGER IF EXISTS trg_activity_sim_cards ON sim_cards;
DROP TRIGGER IF EXISTS trg_activity_sim_plans ON sim_plans;
DROP TRIGGER IF EXISTS trg_activity_device_input_fields ON device_input_fields;
DROP TRIGGER IF EXISTS trg_activity_devices ON devices;
DROP TRIGGER IF EXISTS trg_activity_users ON users;

DROP FUNCTION IF EXISTS activity_audit_trigger_fn();
DROP FUNCTION IF EXISTS activity_diff_ignore_keys(text);
DROP FUNCTION IF EXISTS activity_enrich_changes(jsonb);
DROP FUNCTION IF EXISTS activity_resolve_ref_label(text, jsonb);
DROP FUNCTION IF EXISTS activity_is_staff_actor(uuid);
DROP FUNCTION IF EXISTS activity_is_dashboard_preference_update(text, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS insert_activity_log(uuid, text, activity_action, uuid, text, jsonb, jsonb, varchar);
DROP FUNCTION IF EXISTS activity_resolve_action(text, jsonb, jsonb);
DROP FUNCTION IF EXISTS activity_jsonb_diff(jsonb, jsonb, text[]);
DROP FUNCTION IF EXISTS activity_get_entity_label(text, jsonb);
DROP FUNCTION IF EXISTS activity_get_ip_address();
DROP FUNCTION IF EXISTS activity_get_actor_id();

DROP TABLE IF EXISTS activity_logs;
DROP TYPE IF EXISTS activity_action;
