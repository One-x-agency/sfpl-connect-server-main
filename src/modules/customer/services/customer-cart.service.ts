import type { DatabaseClient } from '@/service/database/index.js';
import ServerError from '@/core/serverError.class.js';

async function assertCustomerExists(db: DatabaseClient, customerId: string) {
  const customer = await db.namedQueryOne(
    `SELECT id FROM users WHERE id = $customer_id AND role = 'customer'`,
    { customer_id: customerId },
  );
  if (!customer) throw new ServerError('Customer not found');
}

async function getOrCreateCustomerCartId(db: DatabaseClient, customerId: string) {
  const existing = await db.namedQueryOne<{ id: string }>(
    `SELECT id FROM connect_store_carts WHERE customer_id = $customer_id`,
    { customer_id: customerId },
  );
  if (existing) return existing.id;

  const created = await db.namedQueryOne<{ id: string }>(
    `INSERT INTO connect_store_carts (customer_id) VALUES ($customer_id) RETURNING id`,
    { customer_id: customerId },
  );
  return created!.id;
}

export async function getCustomerStoreCart(db: DatabaseClient, customerId: string) {
  await assertCustomerExists(db, customerId);

  const cart = await db.namedQueryOne<{
    id: string;
    remark: string | null;
    updated_at: string | null;
  }>(
    `SELECT id, remark, updated_at
     FROM connect_store_carts
     WHERE customer_id = $customer_id`,
    { customer_id: customerId },
  );

  if (!cart) {
    return {
      id: null,
      remark: null,
      updated_at: null,
      items: [],
      total_amount_in_paisa: 0,
    };
  }

  const items = await db.namedQueryAll(
    `SELECT
      ci.device_id,
      ci.quantity,
      d.name AS device_name,
      d.slug,
      d.hsn_sac,
      d.price_in_paisa,
      d.price_in_rupee,
      d.in_stock,
      CASE
        WHEN f.id IS NULL THEN NULL
        ELSE jsonb_build_object('id', f.id, 'key', f.key, 'url', f.url)
      END AS image
     FROM connect_store_cart_items ci
     JOIN connect_store_devices d ON d.id = ci.device_id
     LEFT JOIN files f ON f.id = d.image_id
     WHERE ci.cart_id = $cart_id
     ORDER BY ci.created_at ASC`,
    { cart_id: cart.id },
  );

  const total_amount_in_paisa = items.reduce(
    (sum, item) => sum + Number(item.price_in_paisa) * Number(item.quantity),
    0,
  );

  return {
    id: cart.id,
    remark: cart.remark,
    updated_at: cart.updated_at,
    items,
    total_amount_in_paisa,
  };
}

export async function updateCustomerStoreCartRemark(
  db: DatabaseClient,
  customerId: string,
  remark: string | null,
) {
  await assertCustomerExists(db, customerId);
  const cartId = await getOrCreateCustomerCartId(db, customerId);

  const cart = await db.namedQueryOne(
    `UPDATE connect_store_carts
     SET remark = $remark, updated_at = NOW()
     WHERE id = $cart_id
     RETURNING id, remark, updated_at`,
    { cart_id: cartId, remark },
  );

  const items = await db.namedQueryAll(
    `SELECT
      ci.device_id,
      ci.quantity,
      d.name AS device_name,
      d.slug,
      d.hsn_sac,
      d.price_in_paisa,
      d.price_in_rupee,
      d.in_stock
     FROM connect_store_cart_items ci
     JOIN connect_store_devices d ON d.id = ci.device_id
     WHERE ci.cart_id = $cart_id
     ORDER BY ci.created_at ASC`,
    { cart_id: cartId },
  );

  const total_amount_in_paisa = items.reduce(
    (sum, item) => sum + Number(item.price_in_paisa) * Number(item.quantity),
    0,
  );

  return {
    ...cart,
    items,
    total_amount_in_paisa,
  };
}
