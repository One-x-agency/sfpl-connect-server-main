import type { DatabaseClient } from '@/service/database/index.js';
import ServerError from '@/core/serverError.class.js';

type CartOwner = {
  customerId?: string | null;
  guestCartId?: string | null;
};

export async function resolveCartId(db: DatabaseClient, owner: CartOwner) {
  if (owner.customerId) {
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM connect_store_carts WHERE customer_id = $1',
      [owner.customerId],
    );
    if (existing) return existing.id;

    const created = await db.queryOne<{ id: string }>(
      'INSERT INTO connect_store_carts (customer_id) VALUES ($1) RETURNING id',
      [owner.customerId],
    );
    return created!.id;
  }

  if (!owner.guestCartId) throw new ServerError('Guest cart id is required');

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM connect_store_carts WHERE guest_id = $1',
    [owner.guestCartId],
  );
  if (existing) return existing.id;

  const created = await db.queryOne<{ id: string }>(
    'INSERT INTO connect_store_carts (guest_id) VALUES ($1) RETURNING id',
    [owner.guestCartId],
  );
  return created!.id;
}

export async function mergeGuestCartIntoCustomer(
  db: DatabaseClient,
  guestCartId: string,
  customerId: string,
) {
  const guestCart = await db.queryOne<{ id: string }>(
    'SELECT id FROM connect_store_carts WHERE guest_id = $1',
    [guestCartId],
  );
  if (!guestCart) return;

  const customerCartId = await resolveCartId(db, { customerId });

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO connect_store_cart_items (cart_id, device_id, quantity)
       SELECT $1, device_id, quantity
       FROM connect_store_cart_items
       WHERE cart_id = $2
       ON CONFLICT (cart_id, device_id)
       DO UPDATE SET quantity = LEAST(100, connect_store_cart_items.quantity + EXCLUDED.quantity)`,
      [customerCartId, guestCart.id],
    );

    await db.query('DELETE FROM connect_store_cart_items WHERE cart_id = $1', [guestCart.id]);
    await db.query('DELETE FROM connect_store_carts WHERE id = $1', [guestCart.id]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

