-- migrate:up

ALTER TABLE users
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down

ALTER TABLE users
DROP COLUMN IF EXISTS metadata;
