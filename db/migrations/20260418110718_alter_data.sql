-- migrate:up

update device_input_fields set io_pin = 'IR' where io_pin = 'IA';
update device_input_fields set io_pin = 'IY' where io_pin = 'IB';
update device_input_fields set io_pin = 'IB' where io_pin = 'IC';


-- migrate:down

