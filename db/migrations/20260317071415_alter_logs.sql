-- migrate:up


delete from device_logs;

alter table device_logs add column status varchar(50) not null default 'healthy';

-- migrate:down

alter table device_logs drop column status;
