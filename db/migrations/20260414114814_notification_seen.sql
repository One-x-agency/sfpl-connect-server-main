-- migrate:up


alter table notifications add column seen_at timestamp with time zone;

-- migrate:down

alter table notifications drop column seen_at;
