-- migrate:up

insert into users
  (is_admin, name, phone_number, email, password_hash)
values
  (true, 'Root', '1234567890', 'contact@rajraiyani.com', '$2b$07$ld3otBu3bsxG7ICLIldQ8OYfFkhgYzt1vPXavb3tLbKRFg9fVtNOS');

insert into states (name, gst_code, is_union_territory) values
  ('Jammu and Kashmir', '01', true),
  ('Himachal Pradesh', '02', false),
  ('Punjab', '03', false),
  ('Chandigarh', '04', true),
  ('Uttarakhand', '05', false),
  ('Haryana', '06', false),
  ('Delhi', '07', true),
  ('Rajasthan', '08', false),
  ('Uttar Pradesh', '09', false),
  ('Bihar', '10', false),
  ('Sikkim', '11', false),
  ('Arunachal Pradesh', '12', false),
  ('Nagaland', '13', false),
  ('Manipur', '14', false),
  ('Mizoram', '15', false),
  ('Tripura', '16', false),
  ('Meghalaya', '17', false),
  ('Assam', '18', false),
  ('West Bengal', '19', false),
  ('Jharkhand', '20', false),
  ('Odisha', '21', false),
  ('Chhattisgarh', '22', false),
  ('Madhya Pradesh', '23', false),
  ('Gujarat', '24', false),
  ('Daman and Diu', '25', true),
  ('Dadra and Nagar Haveli', '26', true),
  ('Maharashtra', '27', false),
  ('Karnataka', '29', false),
  ('Goa', '30', false),
  ('Lakshadweep', '31', true),
  ('Kerala', '32', false),
  ('Tamil Nadu', '33', false),
  ('Puducherry', '34', true),
  ('Andaman and Nicobar', '35', true),
  ('Telangana', '36', false),
  ('Andhra Pradesh', '37', false),
  ('Ladakh', '38', true);


-- migrate:down

