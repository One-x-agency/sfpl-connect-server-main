-- migrate:up


create table notification_tokens (
  user_id uuid not null constraint fk_notification_tokens_user_id references users(id),
  token text not null,
  created_at timestamp with time zone not null default now(),
  constraint pk_notification_tokens_user_id_token unique (user_id, token)
);

alter table notifications alter column body drop not null;
alter table notifications add column type varchar(100) not null default 'custom_notification';
alter table notifications rename column meta_data to data;
alter table notifications add column meta_data jsonb not null default '{}';

create table notification_logs (
  user_id uuid not null constraint fk_notification_logs_user_id references users(id),
  type varchar(100) not null,
  transport varchar(100) not null,
  description text not null,
  meta_data jsonb not null default '{}',
  created_at timestamp with time zone not null default now()
)

-- migrate:down

drop table if exists notification_tokens;
alter table notifications alter column body set not null;
alter table notifications drop column type;
alter table notifications rename column data to meta_data;
alter table notifications drop column meta_data;
