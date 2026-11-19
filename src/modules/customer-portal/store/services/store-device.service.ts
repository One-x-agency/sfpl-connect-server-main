import type { DatabaseClient } from '@/service/database/index.js';

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

export async function listStoreDevices(
  db: DatabaseClient,
  params: { offset?: number; limit?: number } = {},
) {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 12;

  const devices = await db.namedQueryAll(
    `SELECT ${deviceSelectFields} ${deviceJoins}
     WHERE d.is_active = true
     ORDER BY d.sort_order ASC, d.created_at DESC
     OFFSET $offset LIMIT $limit`,
    { offset, limit },
  );

  return devices;
}

export async function getStoreDeviceBySlug(db: DatabaseClient, slug: string) {
  const device = await db.namedQueryOne(
    `SELECT ${deviceSelectFields}, d.image_id ${deviceJoins}
     WHERE d.slug = $slug AND d.is_active = true`,
    { slug },
  );

  return device;
}
