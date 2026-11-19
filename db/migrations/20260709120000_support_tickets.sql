-- migrate:up

CREATE TYPE support_ticket_status AS ENUM (
  'open',
  'closed'
);

CREATE SEQUENCE support_ticket_serial_seq;

CREATE TABLE support_tickets (
  id uuid DEFAULT uuidv7() CONSTRAINT pk_support_tickets PRIMARY KEY,
  customer_id uuid NOT NULL CONSTRAINT fk_support_tickets_customer_id REFERENCES users (id),
  serial_number integer NOT NULL DEFAULT nextval('support_ticket_serial_seq'),
  serial varchar(50) GENERATED ALWAYS AS (('SFPL-TKT-'::text || serial_number)) STORED,
  title varchar(255) NOT NULL,
  description text NOT NULL,
  status support_ticket_status NOT NULL DEFAULT 'open',
  remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  closed_at timestamptz
);

CREATE TABLE support_ticket_attachments (
  id uuid DEFAULT uuidv7() CONSTRAINT pk_support_ticket_attachments PRIMARY KEY,
  ticket_id uuid NOT NULL CONSTRAINT fk_support_ticket_attachments_ticket_id
    REFERENCES support_tickets (id) ON DELETE CASCADE,
  file_id uuid NOT NULL CONSTRAINT fk_support_ticket_attachments_file_id REFERENCES files (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_support_ticket_attachments_ticket_file UNIQUE (ticket_id, file_id)
);

CREATE INDEX idx_support_tickets_customer_status ON support_tickets (customer_id, status);
CREATE INDEX idx_support_tickets_status_created_at ON support_tickets (status, created_at DESC);
CREATE INDEX idx_support_tickets_serial ON support_tickets (serial);
CREATE INDEX idx_support_ticket_attachments_ticket_id ON support_ticket_attachments (ticket_id);

CREATE TABLE support_ticket_remarks (
  id uuid DEFAULT uuidv7() CONSTRAINT pk_support_ticket_remarks PRIMARY KEY,
  ticket_id uuid NOT NULL CONSTRAINT fk_support_ticket_remarks_ticket_id
    REFERENCES support_tickets (id) ON DELETE CASCADE,
  remark text NOT NULL,
  created_by uuid NOT NULL CONSTRAINT fk_support_ticket_remarks_created_by REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_ticket_remarks_ticket_id_created_at
  ON support_ticket_remarks (ticket_id, created_at DESC);

-- Legacy triggers still call log_staff_user_activity(), which inserts into
-- staff_activity_logs(actor_id, target_user_id, action, changes).
-- The table now uses (actor_id, action, module, entity_id, summary).
-- User changes are already audited by trg_activity_users -> activity_logs.

DROP TRIGGER IF EXISTS trg_staff_activity_insert ON users;
DROP TRIGGER IF EXISTS trg_staff_activity_update ON users;

DROP FUNCTION IF EXISTS log_staff_user_activity();

-- migrate:down

CREATE OR REPLACE FUNCTION log_staff_user_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
  v_changes jsonb := '{}'::jsonb;
  staff_roles user_role[] := ARRAY[
    'admin',
    'qc',
    'support',
    'accountant',
    'warehouse'
  ]::user_role[];
BEGIN
  v_actor_id := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;

  IF v_actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT (NEW.role = ANY(staff_roles)) THEN
      RETURN NEW;
    END IF;

    INSERT INTO staff_activity_logs (actor_id, action, module, entity_id, summary)
    VALUES (
      v_actor_id,
      'create',
      'users',
      NEW.id,
      COALESCE(NEW.name, NEW.email, NEW.id::text)
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.role = ANY(staff_roles)) THEN
      RETURN NEW;
    END IF;

    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      v_action := 'delete';
    ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_action := CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END;
    ELSE
      v_action := 'update';
    END IF;

    INSERT INTO staff_activity_logs (actor_id, action, module, entity_id, summary)
    VALUES (
      v_actor_id,
      v_action,
      'users',
      NEW.id,
      COALESCE(NEW.name, NEW.email, NEW.id::text)
    );

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_staff_activity_insert
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_staff_user_activity();

CREATE TRIGGER trg_staff_activity_update
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_staff_user_activity();

DROP TABLE IF EXISTS support_ticket_remarks;
DROP TABLE IF EXISTS support_ticket_attachments;
DROP TABLE IF EXISTS support_tickets;
DROP SEQUENCE IF EXISTS support_ticket_serial_seq;
DROP TYPE IF EXISTS support_ticket_status;
