-- migrate:up


alter table users alter column password_hash drop not null;

alter table users add column login_method varchar(100) not null default 'email';


alter table users alter column phone_number drop not null;

-- migrate:down

alter table users alter column password_hash set not null;

alter table users drop column login_method;

alter table users alter column phone_number set not null;
