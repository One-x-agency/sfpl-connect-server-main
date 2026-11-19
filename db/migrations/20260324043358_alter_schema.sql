-- migrate:up



update devices set project_id = null where project_id in (
  select id from projects where user_id in (
    select id from users where role = 'admin' or role = 'user'
  )
);

delete from projects where user_id in (
  select id from users where role = 'admin' or role = 'user'
);


-- migrate:down

