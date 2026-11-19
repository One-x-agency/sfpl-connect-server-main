-- migrate:up

create type user_role as enum ('admin', 'user', 'customer');

alter table users add column role user_role not null default 'user';

update users set role = 'admin' where is_admin = true;

alter table users drop column is_admin;
alter table users add column is_email_verified boolean not null default false;
alter table users add column is_phone_number_verified boolean not null default false;


insert into users (name, email, phone_number, password_hash, role, is_email_verified, is_phone_number_verified, created_at, updated_at)
select name, email, phone_number, password_hash, 'customer', is_email_verified, is_phone_number_verified, created_at, updated_at
from customers;

alter table projects add column user_id uuid constraint fk_projects_user_id references users(id);

update projects set user_id = (select id from users where email = (
  select email from customers where id = projects.customer_id
));

alter table projects drop column customer_id;

alter table projects alter column user_id set not null;

drop table customers;

alter table devices
add column latitude numeric(10,8);

alter table devices
add column longitude numeric(11,8);

alter table devices
add column user_id uuid constraint fk_devices_user_id references users(id);

alter table device_input_fields
add constraint uk_device_input_fields_device_id_io_pin unique (device_id, io_pin);

alter table device_input_fields
add constraint uk_device_input_fields_device_id_name unique (device_id, name);


create table custom_notification_schemas (
  id uuid not null default uuidv7() constraint pk_custom_notification_schemas_id primary key,
  name varchar(255) not null,
  description text,
  input_field_id uuid not null constraint fk_custom_notification_schemas_input_field_id references device_input_fields(id),
  operator input_field_validation_operator not null,
  value numeric(10,2) not null,
  send_to_email boolean not null default false,
  send_to_sms boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create table notifications (
  id uuid not null default uuidv7() constraint pk_notifications_id primary key,
  user_id uuid not null constraint fk_notifications_user_id references users(id),
  title varchar(255) not null,
  body text not null,
  meta_data jsonb not null default '{}',
  created_at timestamp with time zone not null default now()
);

-- migrate:down

-- 1) Drop notification-related tables
drop table if exists notifications;
drop table if exists custom_notification_schemas;

-- 2) Drop unique constraints on device_input_fields
alter table device_input_fields
  drop constraint if exists uk_device_input_fields_device_id_name;

alter table device_input_fields
  drop constraint if exists uk_device_input_fields_device_id_io_pin;

-- 3) Drop extra columns on devices
alter table devices
  drop constraint if exists fk_devices_user_id,
  drop column if exists user_id,
  drop column if exists longitude,
  drop column if exists latitude;

-- 4) Recreate customers table (as in init)
create table customers (
  id uuid not null default uuidv7() constraint pk_customers_id primary key,
  name varchar(255) not null,
  email varchar(255) not null constraint uk_customers_email unique,
  is_email_verified boolean not null default false,
  phone_number varchar(15) not null constraint uk_customers_phone_number unique,
  is_phone_number_verified boolean not null default false,
  password_hash text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

-- 5) Repopulate customers from users
insert into customers (
  id,
  name,
  email,
  is_email_verified,
  phone_number,
  is_phone_number_verified,
  password_hash,
  created_at,
  updated_at
)
select
  id,
  name,
  email,
  is_email_verified,
  phone_number,
  is_phone_number_verified,
  password_hash,
  created_at,
  updated_at
from users;

-- 6) Restore projects.customer_id referencing customers
alter table projects
  add column customer_id uuid;

update projects
set customer_id = user_id;

alter table projects
  alter column customer_id set not null;

alter table projects
  add constraint fk_projects_customer_id
    foreign key (customer_id) references customers(id);

alter table projects
  drop constraint if exists fk_projects_user_id,
  drop column if exists user_id;

-- 7) Restore users.is_admin and remove role/verification flags
alter table users
  add column is_admin boolean not null default false;

update users
set is_admin = (role = 'admin');

-- Remove customer users (they now live only in customers)
delete from user_sessions
where user_id in (select id from users where role = 'customer');

delete from users
where role = 'customer';

alter table users
  drop column if exists is_phone_number_verified,
  drop column if exists is_email_verified,
  drop column if exists role;

drop type if exists user_role;
