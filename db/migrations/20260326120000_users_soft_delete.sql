-- migrate:up

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- migrate:down

ALTER TABLE users
DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE users
DROP COLUMN IF EXISTS is_deleted;
