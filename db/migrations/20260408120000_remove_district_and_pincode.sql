-- migrate:up

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS fk_projects_district_id;

ALTER TABLE projects
  DROP COLUMN IF EXISTS district_id,
  DROP COLUMN IF EXISTS pin_code;

DROP TABLE IF EXISTS districts;

-- migrate:down

-- no-op (district and pin_code removal is intentionally irreversible)
