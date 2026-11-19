-- migrate:up

UPDATE users
SET role = 'admin'
WHERE role = 'user';

CREATE TYPE public.user_role_new AS ENUM (
  'admin',
  'customer',
  'qc',
  'support',
  'accountant',
  'warehouse'
);

ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN role TYPE public.user_role_new
  USING role::text::public.user_role_new;

DROP TYPE public.user_role;

ALTER TYPE public.user_role_new RENAME TO user_role;

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'customer'::public.user_role;

-- Demo staff accounts ({role}@specificfire.com). Password hash matches seed user contact@rajraiyani.com.
INSERT INTO users (
  name,
  email,
  phone_number,
  password_hash,
  role,
  is_email_verified,
  is_phone_number_verified
)
SELECT
  v.name,
  v.email,
  v.phone_number,
  v.password_hash,
  v.role,
  v.is_email_verified,
  v.is_phone_number_verified
FROM (
  VALUES
    (
      'Admin Demo',
      'admin@specificfire.com',
      '9033000001',
      '$2b$07$ld3otBu3bsxG7ICLIldQ8OYfFkhgYzt1vPXavb3tLbKRFg9fVtNOS',
      'admin'::public.user_role,
      true,
      true
    ),
    (
      'QC Demo',
      'qc@specificfire.com',
      '9033000002',
      '$2b$07$ld3otBu3bsxG7ICLIldQ8OYfFkhgYzt1vPXavb3tLbKRFg9fVtNOS',
      'qc'::public.user_role,
      true,
      true
    ),
    (
      'Support Demo',
      'support@specificfire.com',
      '9033000003',
      '$2b$07$ld3otBu3bsxG7ICLIldQ8OYfFkhgYzt1vPXavb3tLbKRFg9fVtNOS',
      'support'::public.user_role,
      true,
      true
    ),
    (
      'Accountant Demo',
      'accountant@specificfire.com',
      '9033000004',
      '$2b$07$ld3otBu3bsxG7ICLIldQ8OYfFkhgYzt1vPXavb3tLbKRFg9fVtNOS',
      'accountant'::public.user_role,
      true,
      true
    ),
    (
      'Warehouse Demo',
      'warehouse@specificfire.com',
      '9033000005',
      '$2b$07$ld3otBu3bsxG7ICLIldQ8OYfFkhgYzt1vPXavb3tLbKRFg9fVtNOS',
      'warehouse'::public.user_role,
      true,
      true
    )
) AS v(name, email, phone_number, password_hash, role, is_email_verified, is_phone_number_verified)
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE lower(u.email) = lower(v.email)
);

-- migrate:down

DELETE FROM users
WHERE lower(email) IN (
  'admin@specificfire.com',
  'qc@specificfire.com',
  'support@specificfire.com',
  'accountant@specificfire.com',
  'warehouse@specificfire.com'
);

CREATE TYPE public.user_role_old AS ENUM (
  'admin',
  'user',
  'customer'
);

ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN role TYPE public.user_role_old
  USING (
    CASE
      WHEN role::text = 'customer' THEN 'customer'::public.user_role_old
      WHEN role::text = 'admin' THEN 'admin'::public.user_role_old
      ELSE 'user'::public.user_role_old
    END
  );

DROP TYPE public.user_role;

ALTER TYPE public.user_role_old RENAME TO user_role;

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'user'::public.user_role;
