-- migrate:up


create table files (
  id uuid not null default uuidv7() constraint pk_files_id primary key,
  key text not null constraint uk_files_key unique,
  endpoint text not null default 'http://localhost:3007/files',
  url text generated always as (endpoint || '/' || key) stored,
  _status varchar(100) not null default 'pending',
  created_at timestamp with time zone not null default now()
);


CREATE TABLE states (
    id uuid not null default uuidv7() constraint pk_states_id primary key,
    name character varying(255) NOT NULL,
    gst_code character varying(7) NOT NULL,
    is_union_territory boolean DEFAULT false NOT NULL
);

CREATE TABLE sim_plans (
    id uuid not null default uuidv7() constraint pk_sim_plans_id primary key,
    name character varying(255) NOT NULL,
    sms_limit integer DEFAULT 0 NOT NULL,
    data_limit numeric(12,2) DEFAULT 0 NOT NULL,
    call_limit integer DEFAULT 0 NOT NULL,
    subscription_amount numeric(12,2) DEFAULT 0 NOT NULL,
    remark text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);

CREATE TABLE sim_cards (
    id uuid not null default uuidv7() constraint pk_sim_cards_id primary key,
    number character varying(255) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    sim_plan_id uuid NOT NULL,
    imsi_number character varying(50),
    activation_date date,
    deactivation_date date,
    expiry_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);

CREATE TABLE users (
  id uuid not null default uuidv7() constraint pk_users_id primary key,
  is_admin boolean not null default false,
  name varchar(255) not null,
  email varchar(255) not null constraint uk_users_email unique,
  phone_number varchar(15) not null,
  password_hash text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

CREATE TABLE user_sessions (
    id uuid not null default uuidv7() constraint pk_user_sessions_id primary key,
    user_id uuid not null constraint fk_user_sessions_user_id references users(id),
    is_active boolean not null default true,
    created_at timestamp with time zone not null default now(),
    expires_at timestamp with time zone not null,
    logged_out_at timestamp with time zone
);


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

create table projects (
  id uuid not null default uuidv7() constraint pk_projects_id primary key,
  customer_id uuid not null constraint fk_projects_customer_id references customers(id),
  name varchar(255) not null,
  description text,
  address text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create table devices (
  id uuid not null default uuidv7() constraint pk_devices_id primary key,
  imei varchar(15) not null constraint uk_devices_imei unique,
  project_id uuid constraint fk_devices_project_id references projects(id),
  name varchar(255),
  description text,
  sim_card_id uuid constraint fk_devices_sim_card_id references sim_cards(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);


create type input_field_validation_operator as enum ('<', '>', '<=', '>=', '=', '!=');

create type input_field_validation as (
  operator input_field_validation_operator,
  value numeric(10,2)
);

create table device_input_fields (
  id uuid not null default uuidv7() constraint pk_input_fields_id primary key,
  device_id uuid not null constraint fk_input_fields_device_id references devices(id),
  io_pin varchar(20) not null,
  name varchar(255) not null,
  description text,
  conversation_factor numeric(10,2) not null,
  calibration jsonb[] not null,
  validation input_field_validation,
  unit varchar(100),
  created_at timestamp with time zone not null default now()
);


create table device_logs (
  device_id uuid not null constraint fk_device_logs_device_id references devices(id),
  imei varchar(15) not null,
  timestamp timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  data jsonb not null
);

create index idx_device_logs_device_id on device_logs(device_id);
create index idx_device_logs_imei on device_logs(imei);
create index idx_device_logs_timestamp on device_logs(timestamp);
create index idx_device_logs_created_at on device_logs(created_at);




-- migrate:down
drop index if exists idx_device_logs_created_at;
drop index if exists idx_device_logs_timestamp;
drop index if exists idx_device_logs_imei;
drop index if exists idx_device_logs_device_id;

drop table if exists device_logs;
drop table if exists device_input_fields;

drop type if exists input_field_validation;
drop type if exists input_field_validation_operator;

drop table if exists devices;
drop table if exists projects;
drop table if exists customers;
drop table if exists user_sessions;
drop table if exists users;
drop table if exists sim_cards;
drop table if exists sim_plans;
drop table if exists states;
drop table if exists files;
