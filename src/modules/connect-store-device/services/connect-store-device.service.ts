import type { DatabaseClient } from '@/service/database/index.js';
import ServerError from '@/core/serverError.class.js';
import { buildUniqueSlug } from '@/utility/slug.js';

const deviceSelectFields = `
  d.id,
  d.name,
  d.slug,
  d.short_description,
  d.description_md,
  d.hsn_sac,
  d.price_in_paisa,
  d.price_in_rupee,
  d.connect_count,
  d.in_stock,
  d.is_active,
  d.sort_order,
  d.created_at,
  d.updated_at,
  CASE
    WHEN f.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'id', f.id,
      'key', f.key,
      'url', f.url
    )
  END AS image
`;

const deviceJoins = `
  FROM connect_store_devices d
  LEFT JOIN files f ON f.id = d.image_id
`;

type CreateConnectStoreDeviceInput = {
  name: string;
  short_description?: string | null;
  description_md?: string | null;
  hsn_sac: string;
  price_in_rupee: number;
  connect_count: number;
  image_id?: string | null;
  in_stock?: boolean;
  is_active?: boolean;
  sort_order?: number;
  created_by?: string;
};

type UpdateConnectStoreDeviceInput = Partial<CreateConnectStoreDeviceInput> & {
  hsn_sac?: string;
  updated_by?: string;
};

function toPaisa(priceInRupee: number) {
  return Math.round(priceInRupee * 100);
}

async function assertImageExists(db: DatabaseClient, imageId?: string | null) {
  if (!imageId) return;
  const file = await db.namedQueryOne(
    'SELECT id FROM files WHERE id = $image_id',
    { image_id: imageId },
  );
  if (!file) throw new ServerError('Image not found');
}

export async function createConnectStoreDevice(
  db: DatabaseClient,
  input: CreateConnectStoreDeviceInput,
) {
  await assertImageExists(db, input.image_id);
  const slug = await buildUniqueSlug(db, input.name);

  const row = await db.queryOne<{ id: string }>(
    `INSERT INTO connect_store_devices (
      name,
      slug,
      short_description,
      description_md,
      hsn_sac,
      price_in_paisa,
      connect_count,
      image_id,
      in_stock,
      is_active,
      sort_order,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      input.name,
      slug,
      input.short_description ?? null,
      input.description_md ?? null,
      input.hsn_sac,
      toPaisa(input.price_in_rupee),
      input.connect_count,
      input.image_id ?? null,
      input.in_stock ?? false,
      input.is_active ?? true,
      input.sort_order ?? 0,
      input.created_by ?? null,
    ],
  );

  return getConnectStoreDeviceById(db, row!.id);
}

export async function updateConnectStoreDevice(
  db: DatabaseClient,
  id: string,
  input: UpdateConnectStoreDeviceInput,
) {
  const existing = await db.namedQueryOne(
    'SELECT id, name FROM connect_store_devices WHERE id = $id',
    { id },
  );
  if (!existing) throw new ServerError('Connect device not found');

  await assertImageExists(db, input.image_id);

  const slug = input.name ? await buildUniqueSlug(db, input.name, id) : null;

  await db.query(
    `UPDATE connect_store_devices
     SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       short_description = COALESCE($3, short_description),
       description_md = COALESCE($4, description_md),
       hsn_sac = $5,
       price_in_paisa = COALESCE($6, price_in_paisa),
       connect_count = COALESCE($7, connect_count),
       image_id = COALESCE($8, image_id),
       in_stock = COALESCE($9, in_stock),
       is_active = COALESCE($10, is_active),
       sort_order = COALESCE($11, sort_order),
       updated_by = $12,
       updated_at = NOW()
     WHERE id = $13`,
    [
      input.name ?? null,
      slug,
      input.short_description ?? null,
      input.description_md ?? null,
      input.hsn_sac,
      input.price_in_rupee != null ? toPaisa(input.price_in_rupee) : null,
      input.connect_count ?? null,
      input.image_id ?? null,
      input.in_stock ?? null,
      input.is_active ?? null,
      input.sort_order ?? null,
      input.updated_by ?? null,
      id,
    ],
  );

  return getConnectStoreDeviceById(db, id);
}

export async function getConnectStoreDeviceById(db: DatabaseClient, id: string) {
  return db.namedQueryOne(
    `SELECT ${deviceSelectFields}, d.image_id ${deviceJoins} WHERE d.id = $id`,
    { id },
  );
}

export async function getConnectStoreDeviceBySlug(db: DatabaseClient, slug: string) {
  return db.namedQueryOne(
    `SELECT ${deviceSelectFields}, d.image_id ${deviceJoins}
     WHERE d.slug = $slug AND d.is_active = true`,
    { slug },
  );
}

export async function listConnectStoreDevices(
  db: DatabaseClient,
  params: { offset?: number; limit?: number; search?: string; is_active?: boolean } = {},
) {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 30;
  const queryParams: Record<string, unknown> = { offset, limit };
  const conditions: string[] = [];

  if (params.search) {
    queryParams.search = `%${params.search}%`;
    conditions.push('(d.name ILIKE $search OR d.slug ILIKE $search)');
  }

  if (params.is_active != null) {
    queryParams.is_active = params.is_active;
    conditions.push('d.is_active = $is_active');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const devices = await db.namedQueryAll(
    `SELECT ${deviceSelectFields} ${deviceJoins}
     ${whereClause}
     ORDER BY d.sort_order ASC, d.created_at DESC
     OFFSET $offset LIMIT $limit`,
    queryParams,
  );

  return devices;
}
