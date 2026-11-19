\restrict dbmate

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: activity_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_action AS ENUM (
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


--
-- Name: connect_order_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connect_order_payment_status AS ENUM (
    'pending',
    'paid',
    'partially_paid',
    'failed'
);


--
-- Name: connect_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connect_order_status AS ENUM (
    'pending',
    'confirmed',
    'fulfilled',
    'cancelled'
);


--
-- Name: connect_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connect_payment_status AS ENUM (
    'pending',
    'paid',
    'partially_paid',
    'failed'
);


--
-- Name: connect_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connect_status AS ENUM (
    'draft',
    'active',
    'inactive',
    'archived'
);


--
-- Name: connect_store_address_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connect_store_address_type AS ENUM (
    'billing',
    'shipping'
);


--
-- Name: connect_store_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connect_store_payment_status AS ENUM (
    'pending',
    'paid',
    'failed'
);


--
-- Name: customer_address_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.customer_address_type AS ENUM (
    'billing',
    'shipping'
);


--
-- Name: input_field_validation_operator; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.input_field_validation_operator AS ENUM (
    '<',
    '>',
    '<=',
    '>=',
    '=',
    '!='
);


--
-- Name: input_field_validation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.input_field_validation AS (
	operator public.input_field_validation_operator,
	value numeric(10,2)
);


--
-- Name: store_address_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.store_address_type AS ENUM (
    'billing',
    'shipping'
);


--
-- Name: storefront_order_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.storefront_order_payment_status AS ENUM (
    'pending',
    'paid',
    'partially_paid',
    'failed'
);


--
-- Name: storefront_plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.storefront_plan_status AS ENUM (
    'draft',
    'active',
    'inactive',
    'archived'
);


--
-- Name: storefront_service_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.storefront_service_status AS ENUM (
    'active',
    'inactive'
);


--
-- Name: support_ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.support_ticket_status AS ENUM (
    'open',
    'closed',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'customer',
    'qc',
    'support',
    'accountant',
    'warehouse'
);


--
-- Name: activity_audit_trigger_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_audit_trigger_fn() RETURNS trigger
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
  v_metadata jsonb := '{}'::jsonb;
  v_device_id uuid;
  v_device_label text;
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

    IF v_module = 'device_input_fields' THEN
      v_device_id := NEW.device_id;
      SELECT COALESCE(NULLIF(TRIM(d.name), ''), d.imei, d.id::text)
      INTO v_device_label
      FROM devices d
      WHERE d.id = v_device_id;

      v_metadata := jsonb_build_object(
        'device_id', v_device_id,
        'device_label', v_device_label
      );
    END IF;

    INSERT INTO activity_logs (
      user_id, module, action, entity_id, entity_label, metadata, ip_address
    )
    VALUES (
      v_actor_id,
      v_module,
      'create',
      v_entity_id,
      v_entity_label,
      v_metadata,
      v_ip_address
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old_row := to_jsonb(OLD);
    v_entity_id := OLD.id;
    v_entity_label := activity_get_entity_label(v_module, v_old_row);

    IF v_module = 'device_input_fields' THEN
      v_device_id := OLD.device_id;
      SELECT COALESCE(NULLIF(TRIM(d.name), ''), d.imei, d.id::text)
      INTO v_device_label
      FROM devices d
      WHERE d.id = v_device_id;

      v_metadata := jsonb_build_object(
        'device_id', v_device_id,
        'device_label', v_device_label
      );
    END IF;

    INSERT INTO activity_logs (
      user_id, module, action, entity_id, entity_label, metadata, ip_address
    )
    VALUES (
      v_actor_id,
      v_module,
      'delete',
      v_entity_id,
      v_entity_label,
      v_metadata,
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

    IF v_module = 'device_input_fields' THEN
      v_device_id := NEW.device_id;
      SELECT COALESCE(NULLIF(TRIM(d.name), ''), d.imei, d.id::text)
      INTO v_device_label
      FROM devices d
      WHERE d.id = v_device_id;

      v_metadata := jsonb_build_object(
        'device_id', v_device_id,
        'device_label', v_device_label
      );
    END IF;

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
      v_metadata,
      v_ip_address
    );

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: activity_diff_ignore_keys(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_diff_ignore_keys(p_module text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE p_module
    WHEN 'connect_store_orders' THEN ARRAY['updated_at', 'status_details']
    ELSE ARRAY['updated_at']
  END;
$$;


--
-- Name: activity_enrich_changes(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_enrich_changes(p_changes jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE
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


--
-- Name: activity_get_actor_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_get_actor_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;


--
-- Name: activity_get_entity_label(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_get_entity_label(p_module text, p_row jsonb) RETURNS text
    LANGUAGE plpgsql STABLE
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


--
-- Name: activity_get_ip_address(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_get_ip_address() RETURNS character varying
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.ip_address', true), '');
$$;


--
-- Name: activity_is_dashboard_preference_update(text, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_is_dashboard_preference_update(p_module text, p_old_row jsonb, p_new_row jsonb, p_changes jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
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


--
-- Name: activity_is_staff_actor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_is_staff_actor(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
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


--
-- Name: activity_jsonb_diff(jsonb, jsonb, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_jsonb_diff(old_row jsonb, new_row jsonb, ignore_keys text[] DEFAULT ARRAY['updated_at'::text]) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
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


--
-- Name: activity_resolve_action(text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_resolve_action(p_module text, p_changes jsonb, p_new_row jsonb) RETURNS public.activity_action
    LANGUAGE plpgsql IMMUTABLE
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


--
-- Name: activity_resolve_ref_label(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_resolve_ref_label(p_field text, p_value jsonb) RETURNS text
    LANGUAGE plpgsql STABLE
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


--
-- Name: fn_log_staff_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_log_staff_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  ctx text;
  ctx_json jsonb;
BEGIN
  ctx := current_setting('app.staff_activity', true);
  IF ctx IS NULL OR ctx = '' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  ctx_json := ctx::jsonb;

  INSERT INTO staff_activity_logs (
    actor_id,
    action,
    module,
    entity_id,
    summary
  ) VALUES (
    (ctx_json->>'actor_id')::uuid,
    ctx_json->>'action',
    ctx_json->>'module',
    COALESCE(
      NULLIF(ctx_json->>'entity_id', '')::uuid,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
    ),
    ctx_json->>'summary'
  );

  PERFORM set_config('app.staff_activity', '', true);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: insert_activity_log(uuid, text, public.activity_action, uuid, text, jsonb, jsonb, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_activity_log(p_user_id uuid, p_module text, p_action public.activity_action, p_entity_id uuid, p_entity_label text DEFAULT NULL::text, p_changes jsonb DEFAULT NULL::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb, p_ip_address character varying DEFAULT NULL::character varying) RETURNS uuid
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid,
    module character varying(100) NOT NULL,
    action public.activity_action NOT NULL,
    entity_id uuid NOT NULL,
    entity_label character varying(255),
    changes jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_tokens (
    token text NOT NULL,
    meta_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: connect_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_order_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    connect_id uuid NOT NULL,
    connect_name character varying(255) NOT NULL,
    service_id character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    amount_in_paisa integer NOT NULL
);


--
-- Name: connect_order_serial_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.connect_order_serial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: connect_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_orders (
    id uuid DEFAULT uuidv7() NOT NULL,
    customer_id uuid NOT NULL,
    serial_number integer DEFAULT nextval('public.connect_order_serial_seq'::regclass) NOT NULL,
    serial character varying(50) GENERATED ALWAYS AS (('SFPL-CONN-'::text || serial_number)) STORED,
    payment_status public.connect_order_payment_status DEFAULT 'pending'::public.connect_order_payment_status NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    total_amount_in_paisa integer NOT NULL,
    paid_amount_in_paisa integer DEFAULT 0 NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    razorpay_order_id character varying(255),
    razorpay_payment_id character varying(255),
    razorpay_signature text,
    billing_details jsonb NOT NULL,
    billing_address jsonb NOT NULL,
    shipping_address jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: connect_store_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_store_addresses (
    id uuid DEFAULT uuidv7() NOT NULL,
    type public.connect_store_address_type NOT NULL,
    customer_id uuid NOT NULL,
    address text NOT NULL,
    state_id uuid NOT NULL,
    city character varying(255) NOT NULL,
    postal_code character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: connect_store_cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_store_cart_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    cart_id uuid NOT NULL,
    device_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT chk_connect_store_cart_items_quantity CHECK (((quantity > 0) AND (quantity <= 100)))
);


--
-- Name: connect_store_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_store_carts (
    id uuid DEFAULT uuidv7() NOT NULL,
    customer_id uuid,
    guest_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    remark text,
    CONSTRAINT chk_connect_store_carts_owner CHECK ((((customer_id IS NOT NULL) AND (guest_id IS NULL)) OR ((customer_id IS NULL) AND (guest_id IS NOT NULL))))
);


--
-- Name: connect_store_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_store_devices (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    short_description text,
    description_md text,
    price_in_paisa integer NOT NULL,
    price_in_rupee numeric(12,2) GENERATED ALWAYS AS (round(((price_in_paisa)::numeric / 100.0), 2)) STORED,
    image_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    hsn_sac character varying(8),
    in_stock boolean DEFAULT false NOT NULL,
    connect_count integer DEFAULT 1 NOT NULL,
    CONSTRAINT chk_connect_store_devices_connect_count CHECK ((connect_count > 0))
);


--
-- Name: connect_store_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_store_order_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    device_id uuid NOT NULL,
    device_name character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price_in_paisa integer NOT NULL,
    hsn_sac character varying(8)
);


--
-- Name: connect_store_order_serial_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.connect_store_order_serial_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: connect_store_order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_store_order_status_history (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    to_status character varying(50) NOT NULL,
    staff_id uuid,
    staff_name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: connect_store_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_store_orders (
    id uuid DEFAULT uuidv7() NOT NULL,
    customer_id uuid NOT NULL,
    payment_status public.connect_store_payment_status DEFAULT 'pending'::public.connect_store_payment_status NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    total_amount_in_paisa integer NOT NULL,
    paid_amount_in_paisa integer DEFAULT 0 NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    razorpay_order_id character varying(255),
    razorpay_payment_id character varying(255),
    razorpay_signature text,
    serial_number integer,
    billing_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    billing_address jsonb NOT NULL,
    shipping_address jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    serial character varying(50) GENERATED ALWAYS AS (
CASE
    WHEN (serial_number IS NOT NULL) THEN ('SFPL-ORD-'::text || serial_number)
    ELSE NULL::text
END) STORED,
    docket_number character varying(100),
    delivery_partner character varying(100),
    status_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    status_history jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: connects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connects (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    amount_in_paisa integer NOT NULL,
    status public.connect_status DEFAULT 'draft'::public.connect_status NOT NULL,
    service_id character varying(255) NOT NULL,
    can_purchase boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    image_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    slug character varying(255),
    amount_in_rupee numeric(12,2) GENERATED ALWAYS AS (round(((amount_in_paisa)::numeric / 100.0), 2)) STORED
);


--
-- Name: cron_job_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_job_runs (
    id uuid DEFAULT uuidv7() NOT NULL,
    cron_job_key character varying(100) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    duration_ms integer,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    error_message text,
    trigger_reason character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: custom_notification_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_notification_schemas (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    input_field_id uuid NOT NULL,
    operator public.input_field_validation_operator NOT NULL,
    value numeric(10,2) NOT NULL,
    send_to_email boolean DEFAULT false NOT NULL,
    send_to_sms boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT uuidv7() NOT NULL,
    type public.store_address_type NOT NULL,
    customer_id uuid NOT NULL,
    address text NOT NULL,
    state_id uuid NOT NULL,
    city character varying(255) NOT NULL,
    postal_code character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: device_input_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_input_fields (
    id uuid DEFAULT uuidv7() NOT NULL,
    device_id uuid NOT NULL,
    io_pin character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    conversation_factor numeric(10,2) NOT NULL,
    calibration jsonb[] NOT NULL,
    validation public.input_field_validation,
    unit character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    priority integer DEFAULT 0 NOT NULL
);


--
-- Name: device_log_archives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_log_archives (
    id uuid DEFAULT uuidv7() NOT NULL,
    device_id uuid NOT NULL,
    imei character varying(15) NOT NULL,
    year_month character(7) NOT NULL,
    s3_bucket character varying(255) NOT NULL,
    s3_key text NOT NULL,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_device_log_archives_year_month CHECK ((year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'::text))
);


--
-- Name: device_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_logs (
    device_id uuid NOT NULL,
    imei character varying(15) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    data jsonb NOT NULL,
    status character varying(50) DEFAULT 'healthy'::character varying NOT NULL
);


--
-- Name: device_serial_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_serial_seq
    START WITH 1200
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT uuidv7() NOT NULL,
    imei character varying(15) NOT NULL,
    project_id uuid,
    name character varying(255),
    description text,
    sim_card_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    latitude numeric(10,8),
    longitude numeric(11,8),
    user_id uuid,
    firmware_version character varying(100) DEFAULT '1.0.0'::character varying NOT NULL,
    meta_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    order_id uuid,
    serial_number integer DEFAULT nextval('public.device_serial_seq'::regclass) NOT NULL,
    serial character varying(50) GENERATED ALWAYS AS (('SFPL-CONNECT-'::text || lpad((serial_number)::text, 5, '0'::text))) STORED,
    batch_number character varying(100)
);


--
-- Name: diagram_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagram_images (
    id uuid DEFAULT uuidv7() NOT NULL,
    diagram_id uuid NOT NULL,
    file_id uuid NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    original_image_id uuid NOT NULL
);


--
-- Name: diagram_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagram_pins (
    id uuid DEFAULT uuidv7() NOT NULL,
    diagram_id uuid NOT NULL,
    input_field_id uuid NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: diagrams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagrams (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT uuidv7() NOT NULL,
    key text NOT NULL,
    endpoint text DEFAULT 'http://localhost:3007/files'::text NOT NULL,
    url text GENERATED ALWAYS AS (((endpoint || '/'::text) || key)) STORED,
    _status character varying(100) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    order_number character varying(50) NOT NULL,
    serial_number integer NOT NULL,
    serial character varying(50) GENERATED ALWAYS AS (('SFPL-INV-'::text || serial_number)) STORED,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(50) DEFAULT 'issued'::character varying NOT NULL,
    billing_details jsonb NOT NULL,
    billing_address jsonb NOT NULL,
    shipping_address jsonb NOT NULL,
    place_of_supply_state_name character varying(255) NOT NULL,
    place_of_supply_gst_code character varying(2) NOT NULL,
    is_inter_state boolean NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    charges jsonb DEFAULT '[]'::jsonb NOT NULL,
    taxable_amount_in_paisa integer NOT NULL,
    tax_amount_in_paisa integer NOT NULL,
    total_amount_in_paisa integer NOT NULL,
    seller_gstin character varying(20) NOT NULL,
    seller_state_gst_code character varying(2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: notification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_logs (
    user_id uuid NOT NULL,
    type character varying(100) NOT NULL,
    transport character varying(100) NOT NULL,
    description text NOT NULL,
    meta_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_tokens (
    user_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    data jsonb DEFAULT '{}'::jsonb CONSTRAINT notifications_meta_data_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type character varying(100) DEFAULT 'custom_notification'::character varying NOT NULL,
    meta_data jsonb DEFAULT '{}'::jsonb CONSTRAINT notifications_meta_data_not_null1 NOT NULL,
    seen_at timestamp with time zone
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    address text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    user_id uuid NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: sim_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sim_cards (
    id uuid DEFAULT uuidv7() NOT NULL,
    number character varying(255) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    sim_plan_id uuid NOT NULL,
    imsi_number character varying(50),
    activation_date date,
    deactivation_date date,
    expiry_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: sim_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sim_plans (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    sms_limit integer DEFAULT 0 NOT NULL,
    data_limit numeric(12,2) DEFAULT 0 NOT NULL,
    call_limit integer DEFAULT 0 NOT NULL,
    subscription_amount numeric(12,2) DEFAULT 0 NOT NULL,
    remark text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: staff_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_activity_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    actor_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    module character varying(50) NOT NULL,
    entity_id uuid,
    summary character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    gst_code character varying(7) NOT NULL,
    is_union_territory boolean DEFAULT false NOT NULL
);


--
-- Name: store_cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_cart_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    cart_id uuid NOT NULL,
    connect_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT store_cart_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: store_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_carts (
    id uuid DEFAULT uuidv7() NOT NULL,
    customer_id uuid,
    guest_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: storefront_cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_cart_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    cart_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT storefront_cart_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: storefront_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_carts (
    id uuid DEFAULT uuidv7() NOT NULL,
    customer_id uuid,
    guest_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: storefront_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_order_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    plan_name character varying(255) NOT NULL,
    service_id uuid NOT NULL,
    service_name character varying(255) NOT NULL,
    quantity integer NOT NULL,
    amount_in_paisa integer NOT NULL
);


--
-- Name: storefront_order_serial_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.storefront_order_serial_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: storefront_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_orders (
    id uuid DEFAULT uuidv7() NOT NULL,
    customer_id uuid NOT NULL,
    serial_number integer DEFAULT nextval('public.storefront_order_serial_number_seq'::regclass) NOT NULL,
    serial character varying(50) GENERATED ALWAYS AS (('SFPL-ORD-'::text || serial_number)) STORED,
    payment_status public.storefront_order_payment_status DEFAULT 'pending'::public.storefront_order_payment_status NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    total_amount_in_paisa integer NOT NULL,
    paid_amount_in_paisa integer DEFAULT 0 NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    razorpay_order_id character varying(255),
    razorpay_payment_id character varying(255),
    razorpay_signature text,
    billing_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    billing_address jsonb DEFAULT '{}'::jsonb NOT NULL,
    shipping_address jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: storefront_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_plans (
    id uuid DEFAULT uuidv7() NOT NULL,
    service_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    amount_in_paisa integer NOT NULL,
    amount_in_rupee numeric(12,2) GENERATED ALWAYS AS (round(((amount_in_paisa)::numeric / 100.0), 2)) STORED,
    status public.storefront_plan_status DEFAULT 'draft'::public.storefront_plan_status NOT NULL,
    billing_type character varying(50) DEFAULT 'one_time'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: storefront_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_services (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    status public.storefront_service_status DEFAULT 'active'::public.storefront_service_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: support_ticket_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_attachments (
    id uuid DEFAULT uuidv7() NOT NULL,
    ticket_id uuid NOT NULL,
    file_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_ticket_remarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_remarks (
    id uuid DEFAULT uuidv7() NOT NULL,
    ticket_id uuid NOT NULL,
    remark text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_ticket_serial_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_ticket_serial_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT uuidv7() NOT NULL,
    customer_id uuid NOT NULL,
    serial_number integer DEFAULT nextval('public.support_ticket_serial_seq'::regclass) NOT NULL,
    serial character varying(50) GENERATED ALWAYS AS (('SFPL-TKT-'::text || serial_number)) STORED,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status public.support_ticket_status DEFAULT 'open'::public.support_ticket_status NOT NULL,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    closed_at timestamp with time zone
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    logged_out_at timestamp with time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(15),
    password_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    role public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    is_email_verified boolean DEFAULT false NOT NULL,
    is_phone_number_verified boolean DEFAULT false NOT NULL,
    login_method character varying(100) DEFAULT 'email'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    organization_name character varying(255),
    gst_number character varying(15),
    pan_number character varying(10),
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: cron_job_runs cron_job_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_job_runs
    ADD CONSTRAINT cron_job_runs_pkey PRIMARY KEY (id);


--
-- Name: device_log_archives device_log_archives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_log_archives
    ADD CONSTRAINT device_log_archives_pkey PRIMARY KEY (id);


--
-- Name: diagram_images diagram_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagram_images
    ADD CONSTRAINT diagram_images_pkey PRIMARY KEY (id);


--
-- Name: diagram_pins diagram_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagram_pins
    ADD CONSTRAINT diagram_pins_pkey PRIMARY KEY (id);


--
-- Name: diagrams diagrams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagrams
    ADD CONSTRAINT diagrams_pkey PRIMARY KEY (id);


--
-- Name: auth_tokens pk_auth_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT pk_auth_tokens PRIMARY KEY (token);


--
-- Name: connect_order_items pk_connect_order_items_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_order_items
    ADD CONSTRAINT pk_connect_order_items_id PRIMARY KEY (id);


--
-- Name: connect_orders pk_connect_orders_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_orders
    ADD CONSTRAINT pk_connect_orders_id PRIMARY KEY (id);


--
-- Name: connect_store_addresses pk_connect_store_addresses; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_addresses
    ADD CONSTRAINT pk_connect_store_addresses PRIMARY KEY (id);


--
-- Name: connect_store_cart_items pk_connect_store_cart_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_cart_items
    ADD CONSTRAINT pk_connect_store_cart_items PRIMARY KEY (id);


--
-- Name: connect_store_carts pk_connect_store_carts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_carts
    ADD CONSTRAINT pk_connect_store_carts PRIMARY KEY (id);


--
-- Name: connect_store_devices pk_connect_store_devices; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_devices
    ADD CONSTRAINT pk_connect_store_devices PRIMARY KEY (id);


--
-- Name: connect_store_order_items pk_connect_store_order_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_order_items
    ADD CONSTRAINT pk_connect_store_order_items PRIMARY KEY (id);


--
-- Name: connect_store_order_status_history pk_connect_store_order_status_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_order_status_history
    ADD CONSTRAINT pk_connect_store_order_status_history PRIMARY KEY (id);


--
-- Name: connect_store_orders pk_connect_store_orders; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_orders
    ADD CONSTRAINT pk_connect_store_orders PRIMARY KEY (id);


--
-- Name: connects pk_connects_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connects
    ADD CONSTRAINT pk_connects_id PRIMARY KEY (id);


--
-- Name: custom_notification_schemas pk_custom_notification_schemas_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_notification_schemas
    ADD CONSTRAINT pk_custom_notification_schemas_id PRIMARY KEY (id);


--
-- Name: customer_addresses pk_customer_addresses_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT pk_customer_addresses_id PRIMARY KEY (id);


--
-- Name: devices pk_devices_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT pk_devices_id PRIMARY KEY (id);


--
-- Name: files pk_files_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT pk_files_id PRIMARY KEY (id);


--
-- Name: device_input_fields pk_input_fields_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_input_fields
    ADD CONSTRAINT pk_input_fields_id PRIMARY KEY (id);


--
-- Name: invoices pk_invoices; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT pk_invoices PRIMARY KEY (id);


--
-- Name: notification_tokens pk_notification_tokens_user_id_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT pk_notification_tokens_user_id_token UNIQUE (user_id, token);


--
-- Name: notifications pk_notifications_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT pk_notifications_id PRIMARY KEY (id);


--
-- Name: projects pk_projects_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT pk_projects_id PRIMARY KEY (id);


--
-- Name: sim_cards pk_sim_cards_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sim_cards
    ADD CONSTRAINT pk_sim_cards_id PRIMARY KEY (id);


--
-- Name: sim_plans pk_sim_plans_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sim_plans
    ADD CONSTRAINT pk_sim_plans_id PRIMARY KEY (id);


--
-- Name: states pk_states_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT pk_states_id PRIMARY KEY (id);


--
-- Name: store_cart_items pk_store_cart_items_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_cart_items
    ADD CONSTRAINT pk_store_cart_items_id PRIMARY KEY (id);


--
-- Name: store_carts pk_store_carts_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_carts
    ADD CONSTRAINT pk_store_carts_id PRIMARY KEY (id);


--
-- Name: storefront_cart_items pk_storefront_cart_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cart_items
    ADD CONSTRAINT pk_storefront_cart_items PRIMARY KEY (id);


--
-- Name: storefront_carts pk_storefront_carts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_carts
    ADD CONSTRAINT pk_storefront_carts PRIMARY KEY (id);


--
-- Name: storefront_order_items pk_storefront_order_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_order_items
    ADD CONSTRAINT pk_storefront_order_items PRIMARY KEY (id);


--
-- Name: storefront_orders pk_storefront_orders; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_orders
    ADD CONSTRAINT pk_storefront_orders PRIMARY KEY (id);


--
-- Name: storefront_plans pk_storefront_plans; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_plans
    ADD CONSTRAINT pk_storefront_plans PRIMARY KEY (id);


--
-- Name: storefront_services pk_storefront_services; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_services
    ADD CONSTRAINT pk_storefront_services PRIMARY KEY (id);


--
-- Name: support_ticket_attachments pk_support_ticket_attachments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT pk_support_ticket_attachments PRIMARY KEY (id);


--
-- Name: support_ticket_remarks pk_support_ticket_remarks; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_remarks
    ADD CONSTRAINT pk_support_ticket_remarks PRIMARY KEY (id);


--
-- Name: support_tickets pk_support_tickets; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT pk_support_tickets PRIMARY KEY (id);


--
-- Name: user_sessions pk_user_sessions_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT pk_user_sessions_id PRIMARY KEY (id);


--
-- Name: users pk_users_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users_id PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: staff_activity_logs staff_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_activity_logs
    ADD CONSTRAINT staff_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: connect_store_addresses uk_connect_store_addresses_customer_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_addresses
    ADD CONSTRAINT uk_connect_store_addresses_customer_type UNIQUE (customer_id, type);


--
-- Name: connect_store_cart_items uk_connect_store_cart_items_cart_device; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_cart_items
    ADD CONSTRAINT uk_connect_store_cart_items_cart_device UNIQUE (cart_id, device_id);


--
-- Name: connect_store_carts uk_connect_store_carts_customer_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_carts
    ADD CONSTRAINT uk_connect_store_carts_customer_id UNIQUE (customer_id);


--
-- Name: connect_store_carts uk_connect_store_carts_guest_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_carts
    ADD CONSTRAINT uk_connect_store_carts_guest_id UNIQUE (guest_id);


--
-- Name: connect_store_devices uk_connect_store_devices_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_devices
    ADD CONSTRAINT uk_connect_store_devices_slug UNIQUE (slug);


--
-- Name: connects uk_connects_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connects
    ADD CONSTRAINT uk_connects_slug UNIQUE (slug);


--
-- Name: customer_addresses uk_customer_addresses_customer_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT uk_customer_addresses_customer_type UNIQUE (customer_id, type);


--
-- Name: device_input_fields uk_device_input_fields_device_id_io_pin; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_input_fields
    ADD CONSTRAINT uk_device_input_fields_device_id_io_pin UNIQUE (device_id, io_pin);


--
-- Name: device_input_fields uk_device_input_fields_device_id_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_input_fields
    ADD CONSTRAINT uk_device_input_fields_device_id_name UNIQUE (device_id, name);


--
-- Name: devices uk_devices_imei; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT uk_devices_imei UNIQUE (imei);


--
-- Name: files uk_files_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT uk_files_key UNIQUE (key);


--
-- Name: store_cart_items uk_store_cart_items_cart_connect; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_cart_items
    ADD CONSTRAINT uk_store_cart_items_cart_connect UNIQUE (cart_id, connect_id);


--
-- Name: storefront_cart_items uk_storefront_cart_items_cart_plan; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cart_items
    ADD CONSTRAINT uk_storefront_cart_items_cart_plan UNIQUE (cart_id, plan_id);


--
-- Name: storefront_plans uk_storefront_plans_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_plans
    ADD CONSTRAINT uk_storefront_plans_slug UNIQUE (slug);


--
-- Name: storefront_services uk_storefront_services_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_services
    ADD CONSTRAINT uk_storefront_services_slug UNIQUE (slug);


--
-- Name: support_ticket_attachments uk_support_ticket_attachments_ticket_file; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT uk_support_ticket_attachments_ticket_file UNIQUE (ticket_id, file_id);


--
-- Name: users uk_users_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk_users_email UNIQUE (email);


--
-- Name: device_log_archives uq_device_log_archives_device_month; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_log_archives
    ADD CONSTRAINT uq_device_log_archives_device_month UNIQUE (device_id, year_month);


--
-- Name: devices uq_devices_serial_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT uq_devices_serial_number UNIQUE (serial_number);


--
-- Name: invoices uq_invoices_order_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT uq_invoices_order_id UNIQUE (order_id);


--
-- Name: invoices uq_invoices_serial_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT uq_invoices_serial_number UNIQUE (serial_number);


--
-- Name: idx_activity_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_action ON public.activity_logs USING btree (action);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity_id ON public.activity_logs USING btree (entity_id);


--
-- Name: idx_activity_logs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_module ON public.activity_logs USING btree (module);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_connect_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_order_items_order_id ON public.connect_order_items USING btree (order_id);


--
-- Name: idx_connect_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_orders_customer_id ON public.connect_orders USING btree (customer_id);


--
-- Name: idx_connect_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_orders_payment_status ON public.connect_orders USING btree (payment_status);


--
-- Name: idx_connect_orders_razorpay_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_orders_razorpay_order_id ON public.connect_orders USING btree (razorpay_order_id);


--
-- Name: idx_connect_store_devices_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_store_devices_active_sort ON public.connect_store_devices USING btree (is_active, sort_order, created_at DESC);


--
-- Name: idx_connect_store_order_status_history_order_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_store_order_status_history_order_timestamp ON public.connect_store_order_status_history USING btree (order_id, "timestamp");


--
-- Name: idx_connect_store_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_store_orders_customer_id ON public.connect_store_orders USING btree (customer_id, created_at DESC);


--
-- Name: idx_connect_store_orders_razorpay_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_store_orders_razorpay_order_id ON public.connect_store_orders USING btree (razorpay_order_id);


--
-- Name: idx_connects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connects_status ON public.connects USING btree (status);


--
-- Name: idx_cron_job_runs_key_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cron_job_runs_key_started ON public.cron_job_runs USING btree (cron_job_key, started_at DESC);


--
-- Name: idx_device_log_archives_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_log_archives_device_id ON public.device_log_archives USING btree (device_id, year_month DESC);


--
-- Name: idx_device_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_logs_created_at ON public.device_logs USING btree (created_at);


--
-- Name: idx_device_logs_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_logs_device_id ON public.device_logs USING btree (device_id);


--
-- Name: idx_device_logs_imei; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_logs_imei ON public.device_logs USING btree (imei);


--
-- Name: idx_device_logs_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_logs_latest ON public.device_logs USING btree (device_id, "timestamp" DESC, created_at DESC);


--
-- Name: idx_device_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_logs_timestamp ON public.device_logs USING btree ("timestamp");


--
-- Name: idx_devices_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_order_id ON public.devices USING btree (order_id);


--
-- Name: idx_devices_unassigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_unassigned ON public.devices USING btree (created_at DESC) WHERE (user_id IS NULL);


--
-- Name: idx_invoices_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_order_number ON public.invoices USING btree (order_number);


--
-- Name: idx_invoices_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_serial ON public.invoices USING btree (serial);


--
-- Name: idx_staff_activity_logs_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_activity_logs_actor_id ON public.staff_activity_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_staff_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_activity_logs_created_at ON public.staff_activity_logs USING btree (created_at DESC);


--
-- Name: idx_staff_activity_logs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_activity_logs_module ON public.staff_activity_logs USING btree (module, created_at DESC);


--
-- Name: idx_storefront_plans_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_plans_featured ON public.storefront_plans USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_storefront_plans_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_plans_service_id ON public.storefront_plans USING btree (service_id);


--
-- Name: idx_storefront_plans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_plans_status ON public.storefront_plans USING btree (status) WHERE (status = 'active'::public.storefront_plan_status);


--
-- Name: idx_support_ticket_attachments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_attachments_ticket_id ON public.support_ticket_attachments USING btree (ticket_id);


--
-- Name: idx_support_ticket_remarks_ticket_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_remarks_ticket_id_created_at ON public.support_ticket_remarks USING btree (ticket_id, created_at DESC);


--
-- Name: idx_support_tickets_customer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_customer_status ON public.support_tickets USING btree (customer_id, status);


--
-- Name: idx_support_tickets_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_serial ON public.support_tickets USING btree (serial);


--
-- Name: idx_support_tickets_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status_created_at ON public.support_tickets USING btree (status, created_at DESC);


--
-- Name: uk_connects_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_connects_name_lower ON public.connects USING btree (lower((name)::text));


--
-- Name: uk_connects_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_connects_service_id ON public.connects USING btree (service_id);


--
-- Name: uk_store_carts_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_store_carts_customer_id ON public.store_carts USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: uk_store_carts_guest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_store_carts_guest_id ON public.store_carts USING btree (guest_id) WHERE (guest_id IS NOT NULL);


--
-- Name: uk_storefront_carts_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_storefront_carts_customer_id ON public.storefront_carts USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: uk_storefront_carts_guest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_storefront_carts_guest_id ON public.storefront_carts USING btree (guest_id) WHERE (guest_id IS NOT NULL);


--
-- Name: connect_store_devices trg_activity_connect_store_devices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activity_connect_store_devices AFTER INSERT OR DELETE OR UPDATE ON public.connect_store_devices FOR EACH ROW EXECUTE FUNCTION public.activity_audit_trigger_fn();


--
-- Name: connect_store_orders trg_activity_connect_store_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activity_connect_store_orders AFTER INSERT OR DELETE OR UPDATE ON public.connect_store_orders FOR EACH ROW EXECUTE FUNCTION public.activity_audit_trigger_fn();


--
-- Name: device_input_fields trg_activity_device_input_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activity_device_input_fields AFTER INSERT OR DELETE OR UPDATE ON public.device_input_fields FOR EACH ROW EXECUTE FUNCTION public.activity_audit_trigger_fn();


--
-- Name: devices trg_activity_devices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activity_devices AFTER INSERT OR DELETE OR UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.activity_audit_trigger_fn();


--
-- Name: sim_cards trg_activity_sim_cards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activity_sim_cards AFTER INSERT OR DELETE OR UPDATE ON public.sim_cards FOR EACH ROW EXECUTE FUNCTION public.activity_audit_trigger_fn();


--
-- Name: sim_plans trg_activity_sim_plans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activity_sim_plans AFTER INSERT OR DELETE OR UPDATE ON public.sim_plans FOR EACH ROW EXECUTE FUNCTION public.activity_audit_trigger_fn();


--
-- Name: users trg_activity_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activity_users AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.activity_audit_trigger_fn();


--
-- Name: connect_store_carts trg_staff_activity_connect_store_carts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_connect_store_carts AFTER INSERT OR DELETE OR UPDATE ON public.connect_store_carts FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: connect_store_devices trg_staff_activity_connect_store_devices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_connect_store_devices AFTER INSERT OR DELETE OR UPDATE ON public.connect_store_devices FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: connect_store_orders trg_staff_activity_connect_store_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_connect_store_orders AFTER INSERT OR DELETE OR UPDATE ON public.connect_store_orders FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: device_input_fields trg_staff_activity_device_input_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_device_input_fields AFTER INSERT OR DELETE OR UPDATE ON public.device_input_fields FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: devices trg_staff_activity_devices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_devices AFTER INSERT OR DELETE OR UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: files trg_staff_activity_files; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_files AFTER INSERT OR DELETE OR UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: sim_cards trg_staff_activity_sim_cards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_sim_cards AFTER INSERT OR DELETE OR UPDATE ON public.sim_cards FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: sim_plans trg_staff_activity_sim_plans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_sim_plans AFTER INSERT OR DELETE OR UPDATE ON public.sim_plans FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: users trg_staff_activity_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_activity_users AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.fn_log_staff_activity();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: device_log_archives device_log_archives_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_log_archives
    ADD CONSTRAINT device_log_archives_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;


--
-- Name: connect_order_items fk_connect_order_items_connect_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_order_items
    ADD CONSTRAINT fk_connect_order_items_connect_id FOREIGN KEY (connect_id) REFERENCES public.connects(id);


--
-- Name: connect_order_items fk_connect_order_items_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_order_items
    ADD CONSTRAINT fk_connect_order_items_order_id FOREIGN KEY (order_id) REFERENCES public.connect_orders(id) ON DELETE CASCADE;


--
-- Name: connect_orders fk_connect_orders_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_orders
    ADD CONSTRAINT fk_connect_orders_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: connect_store_addresses fk_connect_store_addresses_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_addresses
    ADD CONSTRAINT fk_connect_store_addresses_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: connect_store_addresses fk_connect_store_addresses_state_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_addresses
    ADD CONSTRAINT fk_connect_store_addresses_state_id FOREIGN KEY (state_id) REFERENCES public.states(id);


--
-- Name: connect_store_cart_items fk_connect_store_cart_items_cart_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_cart_items
    ADD CONSTRAINT fk_connect_store_cart_items_cart_id FOREIGN KEY (cart_id) REFERENCES public.connect_store_carts(id) ON DELETE CASCADE;


--
-- Name: connect_store_cart_items fk_connect_store_cart_items_device_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_cart_items
    ADD CONSTRAINT fk_connect_store_cart_items_device_id FOREIGN KEY (device_id) REFERENCES public.connect_store_devices(id);


--
-- Name: connect_store_carts fk_connect_store_carts_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_carts
    ADD CONSTRAINT fk_connect_store_carts_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: connect_store_devices fk_connect_store_devices_image_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_devices
    ADD CONSTRAINT fk_connect_store_devices_image_id FOREIGN KEY (image_id) REFERENCES public.files(id);


--
-- Name: connect_store_order_items fk_connect_store_order_items_device_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_order_items
    ADD CONSTRAINT fk_connect_store_order_items_device_id FOREIGN KEY (device_id) REFERENCES public.connect_store_devices(id);


--
-- Name: connect_store_order_items fk_connect_store_order_items_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_order_items
    ADD CONSTRAINT fk_connect_store_order_items_order_id FOREIGN KEY (order_id) REFERENCES public.connect_store_orders(id) ON DELETE CASCADE;


--
-- Name: connect_store_order_status_history fk_connect_store_order_status_history_order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_order_status_history
    ADD CONSTRAINT fk_connect_store_order_status_history_order FOREIGN KEY (order_id) REFERENCES public.connect_store_orders(id) ON DELETE CASCADE;


--
-- Name: connect_store_order_status_history fk_connect_store_order_status_history_staff; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_order_status_history
    ADD CONSTRAINT fk_connect_store_order_status_history_staff FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: connect_store_orders fk_connect_store_orders_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_store_orders
    ADD CONSTRAINT fk_connect_store_orders_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: connects fk_connects_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connects
    ADD CONSTRAINT fk_connects_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: connects fk_connects_image_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connects
    ADD CONSTRAINT fk_connects_image_id FOREIGN KEY (image_id) REFERENCES public.files(id);


--
-- Name: connects fk_connects_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connects
    ADD CONSTRAINT fk_connects_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: custom_notification_schemas fk_custom_notification_schemas_input_field_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_notification_schemas
    ADD CONSTRAINT fk_custom_notification_schemas_input_field_id FOREIGN KEY (input_field_id) REFERENCES public.device_input_fields(id);


--
-- Name: customer_addresses fk_customer_addresses_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT fk_customer_addresses_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: customer_addresses fk_customer_addresses_state_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT fk_customer_addresses_state_id FOREIGN KEY (state_id) REFERENCES public.states(id);


--
-- Name: device_logs fk_device_logs_device_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_logs
    ADD CONSTRAINT fk_device_logs_device_id FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: devices fk_devices_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT fk_devices_order_id FOREIGN KEY (order_id) REFERENCES public.connect_store_orders(id) ON DELETE SET NULL;


--
-- Name: devices fk_devices_project_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT fk_devices_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: devices fk_devices_sim_card_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT fk_devices_sim_card_id FOREIGN KEY (sim_card_id) REFERENCES public.sim_cards(id);


--
-- Name: devices fk_devices_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT fk_devices_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: diagram_images fk_diagram_images_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagram_images
    ADD CONSTRAINT fk_diagram_images_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: diagram_images fk_diagram_images_diagram_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagram_images
    ADD CONSTRAINT fk_diagram_images_diagram_id FOREIGN KEY (diagram_id) REFERENCES public.diagrams(id);


--
-- Name: diagram_images fk_diagram_images_file_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagram_images
    ADD CONSTRAINT fk_diagram_images_file_id FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: diagram_pins fk_diagram_pins_diagram_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagram_pins
    ADD CONSTRAINT fk_diagram_pins_diagram_id FOREIGN KEY (diagram_id) REFERENCES public.diagrams(id);


--
-- Name: diagram_pins fk_diagram_pins_input_field_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagram_pins
    ADD CONSTRAINT fk_diagram_pins_input_field_id FOREIGN KEY (input_field_id) REFERENCES public.device_input_fields(id);


--
-- Name: diagrams fk_diagrams_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagrams
    ADD CONSTRAINT fk_diagrams_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: device_input_fields fk_input_fields_device_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_input_fields
    ADD CONSTRAINT fk_input_fields_device_id FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: invoices fk_invoices_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoices_order_id FOREIGN KEY (order_id) REFERENCES public.connect_store_orders(id) ON DELETE CASCADE;


--
-- Name: notification_logs fk_notification_logs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT fk_notification_logs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notification_tokens fk_notification_tokens_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT fk_notification_tokens_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications fk_notifications_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: projects fk_projects_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT fk_projects_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: store_cart_items fk_store_cart_items_cart_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_cart_items
    ADD CONSTRAINT fk_store_cart_items_cart_id FOREIGN KEY (cart_id) REFERENCES public.store_carts(id) ON DELETE CASCADE;


--
-- Name: store_cart_items fk_store_cart_items_connect_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_cart_items
    ADD CONSTRAINT fk_store_cart_items_connect_id FOREIGN KEY (connect_id) REFERENCES public.connects(id);


--
-- Name: store_carts fk_store_carts_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_carts
    ADD CONSTRAINT fk_store_carts_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: storefront_cart_items fk_storefront_cart_items_cart_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cart_items
    ADD CONSTRAINT fk_storefront_cart_items_cart_id FOREIGN KEY (cart_id) REFERENCES public.storefront_carts(id) ON DELETE CASCADE;


--
-- Name: storefront_cart_items fk_storefront_cart_items_plan_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cart_items
    ADD CONSTRAINT fk_storefront_cart_items_plan_id FOREIGN KEY (plan_id) REFERENCES public.storefront_plans(id);


--
-- Name: storefront_carts fk_storefront_carts_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_carts
    ADD CONSTRAINT fk_storefront_carts_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: storefront_order_items fk_storefront_order_items_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_order_items
    ADD CONSTRAINT fk_storefront_order_items_order_id FOREIGN KEY (order_id) REFERENCES public.storefront_orders(id) ON DELETE CASCADE;


--
-- Name: storefront_order_items fk_storefront_order_items_plan_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_order_items
    ADD CONSTRAINT fk_storefront_order_items_plan_id FOREIGN KEY (plan_id) REFERENCES public.storefront_plans(id);


--
-- Name: storefront_orders fk_storefront_orders_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_orders
    ADD CONSTRAINT fk_storefront_orders_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: storefront_plans fk_storefront_plans_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_plans
    ADD CONSTRAINT fk_storefront_plans_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: storefront_plans fk_storefront_plans_service_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_plans
    ADD CONSTRAINT fk_storefront_plans_service_id FOREIGN KEY (service_id) REFERENCES public.storefront_services(id);


--
-- Name: storefront_plans fk_storefront_plans_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_plans
    ADD CONSTRAINT fk_storefront_plans_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: storefront_services fk_storefront_services_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_services
    ADD CONSTRAINT fk_storefront_services_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: storefront_services fk_storefront_services_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_services
    ADD CONSTRAINT fk_storefront_services_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: support_ticket_attachments fk_support_ticket_attachments_file_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT fk_support_ticket_attachments_file_id FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: support_ticket_attachments fk_support_ticket_attachments_ticket_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT fk_support_ticket_attachments_ticket_id FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_remarks fk_support_ticket_remarks_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_remarks
    ADD CONSTRAINT fk_support_ticket_remarks_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: support_ticket_remarks fk_support_ticket_remarks_ticket_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_remarks
    ADD CONSTRAINT fk_support_ticket_remarks_ticket_id FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets fk_support_tickets_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT fk_support_tickets_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: user_sessions fk_user_sessions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: staff_activity_logs staff_activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_activity_logs
    ADD CONSTRAINT staff_activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260213214937'),
    ('20260302120309'),
    ('20260311122303'),
    ('20260316110000'),
    ('20260317052957'),
    ('20260317071415'),
    ('20260320103822'),
    ('20260320123317'),
    ('20260321103000'),
    ('20260324043358'),
    ('20260326120000'),
    ('20260331084148'),
    ('20260402053842'),
    ('20260403122359'),
    ('20260406120000'),
    ('20260408120000'),
    ('20260410072552'),
    ('20260414114814'),
    ('20260418110718'),
    ('20260521120000'),
    ('20260608120000'),
    ('20260619120000'),
    ('20260619129000'),
    ('20260619130000'),
    ('20260619140000'),
    ('20260620120000'),
    ('20260620120100'),
    ('20260622120000'),
    ('20260623120000'),
    ('20260623130000'),
    ('20260623140000'),
    ('20260624120000'),
    ('20260625120000'),
    ('20260626120000'),
    ('20260627120000'),
    ('20260628120000'),
    ('20260629120000'),
    ('20260630120000'),
    ('20260701120000'),
    ('20260702120000'),
    ('20260702130000'),
    ('20260703120000'),
    ('20260703140000'),
    ('20260703143000'),
    ('20260703150000'),
    ('20260706120000'),
    ('20260706140000'),
    ('20260709120000'),
    ('20260709143000'),
    ('20260709160000'),
    ('20260709180000'),
    ('20260722120000'),
    ('20260722150000'),
    ('20260722160000'),
    ('20260722180000'),
    ('20260724120000'),
    ('20260730124500'),
    ('20260730131500'),
    ('20260731101500'),
    ('20260731123000');
