export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function buildUniqueSlug(
  database: { queryOne: (sql: string, params?: unknown[]) => Promise<{ slug: string } | null> },
  name: string,
  excludeId?: string,
) {
  const baseSlug = slugify(name) || 'device';
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await database.queryOne(
      `SELECT slug
       FROM connect_store_devices
       WHERE slug = $1
         AND ($2::uuid IS NULL OR id <> $2::uuid)`,
      [slug, excludeId ?? null],
    );

    if (!existing) return slug;

    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}
