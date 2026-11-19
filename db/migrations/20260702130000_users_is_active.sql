-- migrate:up
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- migrate:down
ALTER TABLE users
  DROP COLUMN IF EXISTS is_active;
