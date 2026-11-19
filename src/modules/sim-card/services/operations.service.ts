import type { Context } from '@/core/registerService.js';
import RegisterService from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';

/* CREATE */

async function createSimCardService(ctx: Context, input: any) {
  const db = ctx.database!;

  const simCard = await db.queryOne(
    `
    INSERT INTO sim_cards
      (number, is_active, sim_plan_id, imsi_number, activation_date, deactivation_date, expiry_date, created_by)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `,
    [
      input.number,
      input.is_active,
      input.sim_plan_id,
      input.imsi_number,
      input.activation_date,
      input.deactivation_date,
      input.expiry_date,
      input.created_by,
    ],
  );

  return simCard;
}

/* GET */

async function getSimCardService(ctx: Context, id: string) {
  const db = ctx.database!;

  const simCard = await db.queryOne(
    'SELECT * FROM sim_cards WHERE id = $1',
    [id],
  );

  return simCard;
}

/* UPDATE */

async function updateSimCardService(ctx: Context, id: string, input: any) {
  const db = ctx.database!;

  const updates = [];

  if (input.number !== undefined) updates.push('number = $number');
  if (input.is_active !== undefined) updates.push('is_active = $is_active');
  if (input.sim_plan_id !== undefined) updates.push('sim_plan_id = $sim_plan_id');
  if (input.imsi_number !== undefined) updates.push('imsi_number = $imsi_number');
  if (input.activation_date !== undefined) updates.push('activation_date = $activation_date');
  if (input.deactivation_date !== undefined) updates.push('deactivation_date = $deactivation_date');
  if (input.expiry_date !== undefined) updates.push('expiry_date = $expiry_date');

  if (!updates.length) throw new ServerError('No updatable fields provided');

  updates.push('updated_by = $updated_by');
  updates.push('updated_at = now()');

  const updated = await db.namedQueryOne(
    `
    UPDATE sim_cards
    SET ${updates.join(', ')}
    WHERE id = $id
    RETURNING *
  `,
    {
      id,
      ...input,
    },
  );

  return updated;
}

/* DELETE */

async function deleteSimCardService(ctx: Context, id: string) {
  const db = ctx.database!;

  const deleted = await db.queryOne(
    'DELETE FROM sim_cards WHERE id = $1 RETURNING id',
    [id],
  );

  return deleted;
}

export const createSimCard = RegisterService(createSimCardService);
export const getSimCard = RegisterService(getSimCardService);
export const updateSimCard = RegisterService(updateSimCardService);
export const deleteSimCard = RegisterService(deleteSimCardService);
