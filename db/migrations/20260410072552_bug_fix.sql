-- migrate:up

update devices d set project_id = null
where
  project_id is not null and
  exists (select id from projects p where p.user_id != d.user_id and p.id = d.project_id);

-- migrate:down

