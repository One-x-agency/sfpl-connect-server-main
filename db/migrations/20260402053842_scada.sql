-- migrate:up

CREATE TABLE diagrams (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL CONSTRAINT fk_diagrams_created_by REFERENCES users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone
);

CREATE TABLE diagram_images (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  diagram_id uuid not null constraint fk_diagram_images_diagram_id references diagrams(id),
  file_id uuid not null constraint fk_diagram_images_file_id references files(id),
  config jsonb not null default '{}'::jsonb,
  created_by uuid not null constraint fk_diagram_images_created_by references users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE diagram_pins (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  diagram_id uuid not null constraint fk_diagram_pins_diagram_id references diagrams(id),
  input_field_id uuid not null constraint fk_diagram_pins_input_field_id references device_input_fields(id),
  config jsonb not null default '{}'::jsonb
);

-- migrate:down

drop table if exists diagram_pins;
drop table if exists diagram_images;
drop table if exists diagrams;

