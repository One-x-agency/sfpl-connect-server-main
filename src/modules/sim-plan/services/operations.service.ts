import type { Context } from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import RegisterService from '@/core/registerService.js';

/* CREATE */

async function createSimPlanService(
  ctx: Context,
  input: any,
) {
  const db = ctx.database!;

  const simPlan = await db.namedQueryOne(
    `
      INSERT INTO sim_plans (
        name,
        sms_limit,
        data_limit,
        call_limit,
        subscription_amount,
        remark,
        created_by
      )
      VALUES (
        $name,
        $sms_limit,
        $data_limit,
        $call_limit,
        $subscription_amount,
        $remark,
        $created_by
      )
      RETURNING *
    `,
    input,
  );

  return simPlan;
}

/* GET */

async function getSimPlanService(
  ctx: Context,
  id: string,
) {
  const db = ctx.database!;

  const simPlan = await db.queryOne(
    'SELECT * FROM sim_plans WHERE id = $1',
    [id],
  );

  return simPlan;
}


/* UPDATE */

async function updateSimPlanService(
  ctx: Context,
  id: string,
  input: any,
) {
  const db = ctx.database!;

  const updateQueryArray = [];

  if (input.name !== undefined) updateQueryArray.push('name = $name');
  if (input.sms_limit !== undefined) updateQueryArray.push('sms_limit = $sms_limit');
  if (input.data_limit !== undefined) updateQueryArray.push('data_limit = $data_limit');
  if (input.call_limit !== undefined) updateQueryArray.push('call_limit = $call_limit');
  if (input.subscription_amount !== undefined) updateQueryArray.push('subscription_amount = $subscription_amount');
  if (input.remark !== undefined) updateQueryArray.push('remark = $remark');

  if (!updateQueryArray.length) throw new ServerError('No updatable fields provided');

  updateQueryArray.push('updated_at = now()');
  updateQueryArray.push('updated_by = $updated_by');

  const updated = await db.namedQueryOne(
    `
      UPDATE sim_plans
      SET ${updateQueryArray.join(', ')}
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

async function deleteSimPlanService(
  ctx: Context,
  id: string,
) {
  const db = ctx.database!;

  await db.queryOne(
    `
      DELETE FROM sim_plans
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );
}

export const createSimPlan = RegisterService(createSimPlanService);
export const getSimPlan = RegisterService(getSimPlanService);
export const updateSimPlan = RegisterService(updateSimPlanService);
export const deleteSimPlan = RegisterService(deleteSimPlanService);
