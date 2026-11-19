import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { resolveCartId } from '@/modules/customer-portal/store/services/cart.service.js';

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const cartId = await resolveCartId(db, {
    customerId: req.storefront?.customerId,
    guestCartId: req.storefront?.guestCartId,
  });

  const cart = await db.queryOne<{ items: Array<Record<string, unknown>> }>(
    `SELECT COALESCE(
      array_agg(
        jsonb_build_object(
          'device_id', ci.device_id,
          'quantity', ci.quantity,
          'device_name', d.name,
          'slug', d.slug,
          'short_description', d.short_description,
          'hsn_sac', d.hsn_sac,
          'price_in_paisa', d.price_in_paisa,
          'price_in_rupee', d.price_in_rupee,
          'connect_count', d.connect_count,
          'in_stock', d.in_stock,
          'image', CASE
            WHEN f.id IS NULL THEN NULL
            ELSE jsonb_build_object('id', f.id, 'key', f.key, 'url', f.url)
          END
        )
      ) FILTER (WHERE ci.device_id IS NOT NULL),
      ARRAY[]::jsonb[]
    ) AS items
    FROM connect_store_cart_items ci
    JOIN connect_store_devices d ON d.id = ci.device_id
    LEFT JOIN files f ON f.id = d.image_id
    WHERE ci.cart_id = $1`,
    [cartId],
  );

  const items = cart?.items ?? [];
  const total_amount_in_paisa = items.reduce(
    (sum, item) => sum + Number(item.price_in_paisa) * Number(item.quantity),
    0,
  );

  return res.status(StatusCodes.OK).json({
    data: {
      items,
      total_amount_in_paisa,
      total_amount_in_rupee: Number((total_amount_in_paisa / 100).toFixed(2)),
      guest_cart_id: req.storefront?.guestCartId,
    },
  });
}
