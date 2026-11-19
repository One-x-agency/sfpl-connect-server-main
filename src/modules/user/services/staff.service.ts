import bcrypt from 'bcryptjs';
import ServerError from '@/core/serverError.class.js';
import { STAFF_ROLES, type StaffRole } from '@/constants/user-role.js';
import type { DatabaseClient } from '@/service/database/index.js';
import { createDefaultDashboardMetadata } from '@/modules/user/dashboardPreferences.defaults.js';

const STAFF_SELECT = `
  id,
  name,
  email,
  phone_number,
  role,
  is_email_verified,
  is_phone_number_verified,
  is_active,
  is_deleted,
  deleted_at,
  created_at,
  updated_at
`;

type CreateStaffInput = {
  name: string;
  email: string;
  phone_number?: string | null;
  password: string;
  role: StaffRole;
};

type UpdateStaffInput = {
  name: string;
  email: string;
  phone_number?: string | null;
  role: StaffRole;
  password?: string;
};

async function countActiveAdmins(db: DatabaseClient) {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM users
     WHERE role = 'admin'
       AND is_deleted = false
       AND is_active = true`,
  );
  return row?.count ?? 0;
}

async function getStaffRow(db: DatabaseClient, staffId: string) {
  const staff = await db.queryOne(
    `SELECT ${STAFF_SELECT}
     FROM users
     WHERE id = $1
       AND role = ANY($2::user_role[])`,
    [staffId, STAFF_ROLES],
  );

  if (!staff) throw new ServerError('Staff member not found');
  return staff;
}

export async function listStaff(
  db: DatabaseClient,
  params: {
    limit: number;
    offset: number;
    search?: string;
    role?: StaffRole;
    include_deleted?: boolean;
    is_active?: boolean;
  },
) {
  let whereClause = `WHERE role = ANY($roles::user_role[])`;

  if (!params.include_deleted) {
    whereClause += ' AND is_deleted = false';
  }

  if (params.is_active != null) {
    whereClause += ' AND is_active = $is_active';
  }

  if (params.role) {
    whereClause += ' AND role = $filter_role::user_role';
  }

  if (params.search) {
    whereClause += ` AND (
      name ILIKE $search
      OR email ILIKE $search
      OR COALESCE(phone_number, '') ILIKE $search
    )`;
  }

  return db.namedQueryAll(
    `SELECT ${STAFF_SELECT}
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $limit
     OFFSET $offset`,
    {
      roles: STAFF_ROLES,
      filter_role: params.role ?? null,
      is_active: params.is_active ?? null,
      search: params.search ? `%${params.search}%` : null,
      limit: params.limit,
      offset: params.offset,
    },
  );
}

export async function getStaff(db: DatabaseClient, staffId: string) {
  return getStaffRow(db, staffId);
}

export async function createStaff(db: DatabaseClient, input: CreateStaffInput) {
  const existing = await db.queryOne(
    `SELECT id FROM users WHERE lower(email) = lower($1)`,
    [input.email],
  );
  if (existing) throw new ServerError('Email is already in use');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const metadata = createDefaultDashboardMetadata();

  const staff = await db.queryOne(
    `INSERT INTO users (
      name,
      email,
      phone_number,
      password_hash,
      role,
      is_email_verified,
      is_phone_number_verified,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5::user_role, true, false, $6::jsonb)
    RETURNING ${STAFF_SELECT}`,
    [
      input.name,
      input.email,
      input.phone_number || null,
      passwordHash,
      input.role,
      JSON.stringify(metadata),
    ],
  );

  return staff;
}

export async function updateStaff(
  db: DatabaseClient,
  staffId: string,
  input: UpdateStaffInput,
  actorId: string,
) {
  const existing = await getStaffRow(db, staffId);

  if (input.email) {
    const duplicate = await db.queryOne(
      `SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2`,
      [input.email, staffId],
    );
    if (duplicate) throw new ServerError('Email is already in use');
  }

  const nextRole = input.role;
  const isDemotingAdmin = existing.role === 'admin' && nextRole !== 'admin';

  if (isDemotingAdmin && (await countActiveAdmins(db)) <= 1) {
    throw new ServerError('At least one active admin is required');
  }

  if (staffId === actorId && nextRole !== 'admin') {
    throw new ServerError('You cannot change your own role');
  }

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, 10)
    : null;

  const staff = await db.queryOne(
    `UPDATE users
     SET
       name = $2,
       email = $3,
       phone_number = $4,
       role = $5::user_role,
       password_hash = COALESCE($6, password_hash),
       updated_at = now()
     WHERE id = $1
       AND role = ANY($7::user_role[])
       AND is_deleted = false
     RETURNING ${STAFF_SELECT}`,
    [
      staffId,
      input.name,
      input.email,
      input.phone_number || null,
      input.role,
      passwordHash,
      STAFF_ROLES,
    ],
  );

  if (!staff) throw new ServerError('Staff member not found');
  return staff;
}

export async function deleteStaff(db: DatabaseClient, staffId: string, actorId: string) {
  const existing = await getStaffRow(db, staffId);

  if (staffId === actorId) {
    throw new ServerError('You cannot delete your own account');
  }

  if (existing.is_deleted) {
    throw new ServerError('Staff member is already deleted');
  }

  if (existing.role === 'admin' && (await countActiveAdmins(db)) <= 1) {
    throw new ServerError('At least one active admin is required');
  }

  await db.queryOne(
    `UPDATE users
     SET
       is_deleted = true,
       is_active = false,
       deleted_at = now(),
       updated_at = now()
     WHERE id = $1
       AND role = ANY($2::user_role[])
       AND is_deleted = false
     RETURNING id`,
    [staffId, STAFF_ROLES],
  );
}

export async function updateStaffStatus(
  db: DatabaseClient,
  staffId: string,
  isActive: boolean,
  actorId: string,
) {
  const existing = await getStaffRow(db, staffId);

  if (existing.is_deleted) {
    throw new ServerError('Deleted staff members cannot be updated');
  }

  if (staffId === actorId && !isActive) {
    throw new ServerError('You cannot disable your own account');
  }

  if (!isActive && existing.role === 'admin' && (await countActiveAdmins(db)) <= 1) {
    throw new ServerError('At least one active admin is required');
  }

  const staff = await db.queryOne(
    `UPDATE users
     SET is_active = $2, updated_at = now()
     WHERE id = $1
       AND role = ANY($3::user_role[])
       AND is_deleted = false
     RETURNING ${STAFF_SELECT}`,
    [staffId, isActive, STAFF_ROLES],
  );

  if (!staff) throw new ServerError('Staff member not found');
  return staff;
}

export async function activateStaff(db: DatabaseClient, staffId: string) {
  const existing = await getStaffRow(db, staffId);

  if (!existing.is_deleted) {
    throw new ServerError('Staff account is already active');
  }

  const duplicate = await db.queryOne(
    `SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2`,
    [existing.email, staffId],
  );
  if (duplicate) {
    throw new ServerError('Cannot restore staff: email is already in use');
  }

  const staff = await db.queryOne(
    `UPDATE users
     SET
       is_deleted = false,
       deleted_at = NULL,
       is_active = true,
       updated_at = now()
     WHERE id = $1
       AND role = ANY($2::user_role[])
       AND is_deleted = true
     RETURNING ${STAFF_SELECT}`,
    [staffId, STAFF_ROLES],
  );

  if (!staff) throw new ServerError('Staff member not found');
  return staff;
}
